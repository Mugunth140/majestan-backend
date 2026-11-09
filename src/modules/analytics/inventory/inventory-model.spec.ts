import {
  areaSqft,
  asking,
  filterInventory,
  issueIndex,
  paise,
  sectionReport,
  validateInventoryFilters,
} from './inventory-model';
import { TrafficRow } from './inventory.types';
import { listing } from './inventory.fixture';
const range = { from: '2026-11-01', to: '2026-11-07' };
const now = Date.parse('2026-11-06T12:00:00Z');
describe('inventory reporting definitions', () => {
  it('separates inventory kind, availability, approval and public state', () => {
    const records = [
      listing(),
      listing({
        key: 'property:2',
        id: 2,
        approval: 'Pending',
        visible: false,
      }),
      listing({
        key: 'project:1',
        kind: 'project',
        id: 1,
        approval: null,
        status: 'draft',
        visible: false,
        declaredUnits: 40,
        configurations: [],
      }),
    ];
    const index = issueIndex(records, now, new Map());
    const result = sectionReport(records, range, index, new Map(), [], now);
    expect(result.metrics.find((m) => m.key === 'properties')?.value).toBe(2);
    expect(
      result.metrics.find((m) => m.key === 'visible_properties')?.value,
    ).toBe(1);
    expect(
      filterInventory(records, { ...range, visible: 'true' }, index).map(
        (r) => r.key,
      ),
    ).toEqual(['property:1']);
    expect(
      filterInventory(
        records,
        { ...range, issue: 'pending_approval' },
        index,
      ).map((r) => r.key),
    ).toEqual(['property:2']);
  });
  it('keeps declared project units distinct from configuration rows', () => {
    const record = listing({
      key: 'project:1',
      kind: 'project',
      declaredUnits: 40,
      configurations: [
        {
          id: 1,
          code: '2BHK',
          type: 'apartment',
          status: 'available',
          mode: 'sale',
          bedrooms: 2,
          price: '5000000.00',
          rent: null,
          builtup: '1000',
          carpet: null,
          plot: null,
        },
      ],
    });
    const result = sectionReport(
      [record],
      { ...range, section: 'projects' },
      issueIndex([record], now, new Map()),
      new Map(),
      [],
      now,
    );
    expect(result.metrics.find((m) => m.key === 'declared')?.value).toBe(40);
    expect(result.metrics.find((m) => m.key === 'configurations')?.value).toBe(
      1,
    );
  });
  it('separates legacy imports and never converts missing prices to zero', () => {
    expect(paise(null)).toBeNull();
    expect(paise('0.00')).toBeNull();
    expect(paise('10000000.25')).toBe(1000000025);
    const records = [
      listing({ legacy: true }),
      listing({ key: 'property:2', id: 2, price: null }),
    ];
    const index = issueIndex(records, now, new Map());
    expect(
      filterInventory(records, { ...range, provenance: 'import' }, index),
    ).toHaveLength(1);
    const report = sectionReport(records, range, index, new Map(), [], now);
    expect(
      report.charts[0].rows
        .filter((r) => r.series === 'Legacy import')
        .reduce((sum, r) => sum + Number(r.value), 0),
    ).toBe(1);
  });
  it('requires a comparable type and mode for pricing and sample coverage for box plots', () => {
    const records = [listing()];
    const index = issueIndex(records, now, new Map());
    expect(
      sectionReport(
        records,
        { ...range, section: 'pricing' },
        index,
        new Map(),
        [],
        now,
      ).selectionRequired,
    ).toBeTruthy();
    expect(
      sectionReport(
        records,
        { ...range, section: 'pricing', mode: 'sale', type: 'apartment' },
        index,
        new Map(),
        [],
        now,
      ).charts.some((c) => c.type === 'box'),
    ).toBe(false);
  });
  it('normalizes area and keeps seat rent and monthly rent separate', () => {
    expect(
      areaSqft(listing({ area: '2', areaBasis: 'plot', areaUnit: 'Cents' })),
    ).toBeCloseTo(871.2);
    expect(
      areaSqft(listing({ areaUnit: 'unknown', areaBasis: 'recorded' })),
    ).toBeNull();
    const record = listing({
      type: 'coworking',
      mode: 'rent',
      price: null,
      rent: '10000',
      seatRent: '2500',
    });
    expect(asking(record, 'rent')).toBe(1000000);
    expect(asking(record, 'seat')).toBe(250000);
  });
  it('does not call incomplete traffic coverage a low-exposure listing', () => {
    const record = listing();
    expect(issueIndex([record], now, new Map()).get(record.key)).not.toContain(
      'low_exposure',
    );
    const traffic = { key: record.key, views: 0 } as TrafficRow;
    expect(
      issueIndex([record], now, new Map([[record.key, traffic]])).get(
        record.key,
      ),
    ).toContain('low_exposure');
  });
  it('flags ambiguous duplicate codes without joining records or losing kind identity', () => {
    const rows = [
      listing(),
      listing({ key: 'project:1', kind: 'project', path: '/project-ap1' }),
    ];
    const index = issueIndex(rows, now, new Map());
    expect(index.get('property:1')).toContain('duplicate_code');
    expect(index.get('project:1')).toContain('duplicate_code');
  });
  it.each([
    { from: '2026-02-30', to: '2026-03-02' },
    { ...range, kind: 'account' },
    { ...range, maxPrice: '-1' },
    { ...range, limit: '0' },
    { ...range, field: 'contact_details' },
  ])('rejects invalid dates and unallowlisted filters', (f) =>
    expect(() => validateInventoryFilters(f)).toThrow(),
  );
  it('forces the relevant listing kind on focused property/project sections', () => {
    expect(
      validateInventoryFilters({ ...range, section: 'projects' }).kind,
    ).toBe('project');
  });
});

describe('matching chart buckets', () => {
  it('returns the exact Other geography bucket and keeps missing cities visible', () => {
    const records = Array.from({ length: 12 }, (_, i) =>
      listing({
        id: i + 1,
        key: 'property:' + (i + 1),
        city: 'City ' + String(i).padStart(2, '0'),
      }),
    );
    const index = issueIndex(records, now, new Map());
    const result = sectionReport(records, range, index, new Map(), [], now);
    const other = result.charts
      .find((c) => c.key === 'cities')!
      .rows.find((r) => r.label === 'Other')!;
    const matching = filterInventory(
      records,
      { ...range, ...(other.match as object) },
      index,
    );
    expect(matching.length).toBe(other.value);
    expect(matching.map((r) => r.city)).toEqual(['City 10', 'City 11']);
    expect(
      filterInventory(
        [listing({ city: null })],
        { ...range, city: '__missing__' },
        index,
      ),
    ).toHaveLength(1);
  });
  it('uses the clicked UTC creation day and provenance for additions', () => {
    const records = [
      listing({ legacy: true }),
      listing({ id: 2, key: 'property:2', created: '2026-11-02T00:00:00Z' }),
    ];
    const index = issueIndex(records, now, new Map());
    const result = sectionReport(records, range, index, new Map(), [], now);
    for (const row of result.charts.find((c) => c.key === 'additions')!.rows) {
      expect(
        filterInventory(records, { ...range, ...(row.match as object) }, index)
          .length,
      ).toBe(row.value);
    }
  });
  it('validates internal drill-down filters as strictly as public filters', () => {
    expect(() =>
      validateInventoryFilters({ ...range, activity: 'unknown' }),
    ).toThrow();
    expect(() =>
      validateInventoryFilters({ ...range, recordAge: 'invalid' }),
    ).toThrow();
  });
});
