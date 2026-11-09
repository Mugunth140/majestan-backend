import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { DuckDBInstance } from '@duckdb/node-api';
import { SiteAnalyticsStore } from './analytics-store.service';
import { ANALYTICS_SCHEMA } from './analytics-schema';

it('returns real inventory without traffic and excludes dateless inventory from period additions', async () => {
  const query = jest
    .fn()
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([
      {
        id: '1',
        path: null,
        kind: 'property',
        title: 'Not published',
        category: 'villa',
        city: 'Coimbatore',
        status: 'available',
        created: null,
      },
    ])
    .mockResolvedValueOnce([
      {
        id: '2',
        path: 'sample-project',
        slug: 'sample',
        kind: 'project',
        title: 'Sample',
        category: 'apartment',
        city: 'Chennai',
        status: 'published',
        created: '2026-11-02T00:00:00Z',
      },
    ]);
  const store = new SiteAnalyticsStore(
    {} as ConfigService,
    { query } as unknown as DataSource,
  );
  const result = await store.propertyInsights('2026-11-01', '2026-11-07');
  expect(result.rows).toEqual([]);
  expect(result.snapshot).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: 'property', total: 1, additions: [] }),
      expect.objectContaining({
        kind: 'project',
        total: 1,
        additions: [{ day: '2026-11-02', count: 1 }],
      }),
    ]),
  );
});

it('counts duplicate canonical aliases once and retains inventory when tracked visits are absent', async () => {
  const db = await DuckDBInstance.create(':memory:');
  const connection = await db.connect();
  try {
    await connection.run(ANALYTICS_SCHEMA);
    await connection.run(
      "INSERT INTO site_events(id,page_id,session_id,visitor_id,kind,name,occurred_at,path) VALUES ('a','p','s','v','pageview','pageview','2026-11-03','/sample')",
    );
    const query = jest
      .fn()
      .mockResolvedValueOnce([
        { path: '/sample', kind: 'property', id: '1', title: 'Sample' },
      ])
      .mockResolvedValueOnce([
        {
          path: 'sample',
          kind: 'property',
          id: '1',
          title: 'Sample',
          status: 'available',
          category: 'villa',
          city: 'Coimbatore',
        },
      ])
      .mockResolvedValueOnce([]);
    const store = new SiteAnalyticsStore(
      {} as ConfigService,
      { query } as unknown as DataSource,
    );
    Object.assign(store, { instance: db });
    const result = await store.propertyInsights('2026-11-01', '2026-11-07');
    expect(result.rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: '1', views: '1' }),
      ]),
    );
    expect(result.snapshot[0].total).toBe(1);
  } finally {
    connection.closeSync();
    db.closeSync();
  }
});
