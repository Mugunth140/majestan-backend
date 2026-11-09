import { DataSource } from 'typeorm';
import { DuckDBInstance, DuckDBConnection } from '@duckdb/node-api';
import { ANALYTICS_SCHEMA } from '../analytics-schema';
import { SiteAnalyticsStore } from '../analytics-store.service';
import { InventoryInsightsService } from './inventory-insights.service';
import { loadInventory } from './inventory-source';
import { listing } from './inventory.fixture';
jest.mock('./inventory-source', () => ({ loadInventory: jest.fn() }));
const source = jest.mocked(loadInventory);
const from = new Date().toISOString().slice(0, 10);
const to = new Date(Date.parse(from) + 86400000).toISOString().slice(0, 10);
const filters = { from, to };
type Report = {
  metrics: { key: string; value: number | null }[];
  sources: Record<string, string>;
  records: { total: number };
  snapshotAt: string;
};
describe('inventory read model and attribution', () => {
  let instance: DuckDBInstance,
    service: InventoryInsightsService,
    db: { query: jest.Mock },
    enabled: boolean;
  const reporting = async <T>(work: (c: DuckDBConnection) => Promise<T>) => {
    if (!enabled) throw new Error('offline');
    const c = await instance.connect();
    try {
      return await work(c);
    } finally {
      c.closeSync();
    }
  };
  beforeEach(async () => {
    enabled = true;
    instance = await DuckDBInstance.create(':memory:');
    await reporting((c) => c.run(ANALYTICS_SCHEMA));
    source.mockResolvedValue([listing()]);
    db = { query: jest.fn().mockResolvedValue([]) };
    service = new InventoryInsightsService(
      db as unknown as DataSource,
      { reporting } as SiteAnalyticsStore,
    );
    await service.refresh(true);
  });
  afterEach(async () => {
    await service.onApplicationShutdown();
    instance.closeSync();
    jest.clearAllMocks();
  });
  it('keeps a consistent immutable daily baseline while refreshing current stock', async () => {
    source.mockResolvedValue([
      listing(),
      listing({ key: 'property:2', id: 2 }),
    ]);
    await service.refresh(true);
    const current = (await service.report(filters)) as Report;
    const historical = (await service.report({
      ...filters,
      asOf: from,
    })) as Report;
    expect(current.records.total).toBe(2);
    expect(historical.records.total).toBe(1);
    expect(historical.snapshotAt).toBeTruthy();
  });
  it('restores the persisted read model when the source fails on restart', async () => {
    source.mockRejectedValueOnce(new Error('source unavailable'));
    const restarted = new InventoryInsightsService(
      db as unknown as DataSource,
      { reporting } as SiteAnalyticsStore,
    );
    const report = (await restarted.report(filters)) as Report;
    expect(report.records.total).toBe(1);
    expect(report.sources.inventory).toBe('stale');
    await restarted.onApplicationShutdown();
  });
  it('does not reload the full catalog on repeated report requests', async () => {
    await service.report(filters);
    await service.report(filters);
    expect(source).toHaveBeenCalledTimes(1);
  });
  it('retains inventory and accepted enquiries when traffic storage is unavailable', async () => {
    enabled = false;
    const r = (await service.report({
      ...filters,
      section: 'demand',
    })) as Report;
    expect(r.records.total).toBe(1);
    expect(r.sources.traffic).toBe('unavailable');
    expect(r.metrics.find((m) => m.key === 'views')?.value).toBeNull();
    expect(r.metrics.find((m) => m.key === 'enquiries')?.value).toBe(0);
  });
  it('joins aliases to one listing and rejects client-claimed identities on unknown paths', async () => {
    await reporting((c) =>
      c.run(
        `INSERT INTO site_events(id,session_id,page_id,visitor_id,kind,name,occurred_at,path,entity_kind,entity_id) VALUES ('a','s','p','v','pageview','page_view',?::DATE,'/sample-ap1','project',5),('b','s','q','v','pageview','page_view',?::DATE,'/unmatched','property',1)`,
        [from, from],
      ),
    );
    const r = (await service.report({
      ...filters,
      section: 'demand',
    })) as Report;
    expect(r.metrics.find((m) => m.key === 'views')?.value).toBe(1);
  });
  it('deduplicates reach and sessions across listings and computes an attributed enquiry rate', async () => {
    source.mockResolvedValue([
      listing(),
      listing({
        id: 2,
        key: 'property:2',
        path: '/second',
        aliases: ['/second'],
      }),
    ]);
    await service.refresh(true);
    db.query.mockImplementation((sql: string) =>
      Promise.resolve(
        sql.includes('SELECT DISTINCT CASE')
          ? [{ key: 'property:1', session: 's' }]
          : sql.includes('FROM leads')
            ? [
                {
                  key: 'property:1',
                  day: from,
                  enquiries: 1,
                  visits: 0,
                  linkedSubmissions: 1,
                  linkedEnquirySessions: 1,
                },
              ]
            : [],
      ),
    );
    await reporting((c) =>
      c.run(
        `INSERT INTO site_events(id,session_id,page_id,visitor_id,kind,name,occurred_at,path) VALUES ('a','s','p','v','pageview','page_view',?::DATE,'/sample-ap1'),('b','s','q','v','pageview','page_view',?::DATE,'/second')`,
        [from, from],
      ),
    );
    const r = (await service.report({
      ...filters,
      section: 'demand',
    })) as Report;
    expect(r.metrics.find((m) => m.key === 'views')?.value).toBe(2);
    expect(r.metrics.find((m) => m.key === 'visitor_days')?.value).toBe(1);
    expect(r.metrics.find((m) => m.key === 'sessions')?.value).toBe(1);
    expect(r.metrics.find((m) => m.key === 'rate')?.value).toBe(100);
  });
  it('keeps ambiguous paths outside attributed totals', async () => {
    source.mockResolvedValue([
      listing(),
      listing({ id: 2, key: 'property:2' }),
    ]);
    await service.refresh(true);
    await reporting((c) =>
      c.run(
        `INSERT INTO site_events(id,session_id,page_id,visitor_id,kind,name,occurred_at,path) VALUES ('a','s','p','v','pageview','page_view',?::DATE,'/sample-ap1')`,
        [from],
      ),
    );
    const r = (await service.report({
      ...filters,
      section: 'demand',
    })) as Report;
    expect(r.metrics.find((m) => m.key === 'views')?.value).toBe(0);
  });
  it('preserves historical aliases across renames', async () => {
    source.mockResolvedValue([
      listing({ path: '/renamed', aliases: ['/renamed'] }),
    ]);
    await service.refresh(true);
    const count = await reporting(
      async (c) =>
        (
          await c.runAndReadAll('SELECT count(*) count FROM inventory_aliases')
        ).getRowObjectsJson()[0].count,
    );
    expect(Number(count)).toBe(2);
  });
  it('rejects snapshots outside coverage rather than reconstructing history', async () => {
    await expect(
      service.report({ ...filters, asOf: '2020-01-01' }),
    ).rejects.toThrow('No inventory snapshot');
  });
  it('reconciles matching record and export totals under identical filters', async () => {
    source.mockResolvedValue([
      listing(),
      listing({ id: 2, key: 'property:2', city: 'Chennai' }),
    ]);
    await service.refresh(true);
    const query = { ...filters, city: 'Chennai' };
    const report = (await service.report(query)) as Report;
    const rows = await service.recordsPage(query);
    const exported = await service.exportRecords(query);
    expect(report.records.total).toBe(1);
    expect(rows.total).toBe(1);
    expect(exported.records).toHaveLength(1);
  });
  it('paginates configuration rows independently from project counts', async () => {
    const c = {
      id: 1,
      code: 'A',
      type: 'apartment',
      status: 'available',
      mode: 'sale',
      bedrooms: 2,
      price: '100',
      rent: null,
      builtup: null,
      carpet: null,
      plot: null,
    };
    source.mockResolvedValue([
      listing({
        kind: 'project',
        key: 'project:1',
        configurations: [c, { ...c, id: 2 }],
      }),
    ]);
    await service.refresh(true);
    const rows = await service.recordsPage({
      ...filters,
      configurationStatus: 'available',
    });
    expect(rows.total).toBe(2);
    expect(rows.configurations).toHaveLength(2);
    expect(
      (
        await service.exportRecords({
          ...filters,
          configurationStatus: 'available',
        })
      ).records,
    ).toHaveLength(2);
  });
  it('validates comparison size and listing kinds', async () => {
    await expect(
      service.compare(['property:1', 'project:1'], filters),
    ).rejects.toThrow('same kind');
    await expect(
      service.compare(['property:1', 'property:1'], filters),
    ).rejects.toThrow('same kind');
  });
  it('projects deletion events durably and retries without duplication', async () => {
    const e = {
      id: 1,
      kind: 'property',
      listing_id: 7,
      subject: 'listing',
      subject_id: 7,
      action: 'delete',
      before_json: { id: 7, status: 'sold' },
      after_json: null,
      occurred_at: new Date(),
    };
    db.query.mockImplementation((sql: string) =>
      Promise.resolve(sql.includes('SELECT id,kind') ? [e] : []),
    );
    await service.refresh(true);
    await service.refresh(true);
    const h = await service.history('property:7');
    expect(h.events).toHaveLength(1);
    expect(h.events[0].action).toBe('delete');
  });
});
