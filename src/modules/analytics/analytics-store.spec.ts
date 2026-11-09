import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { DuckDBInstance } from '@duckdb/node-api';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateBatch } from './analytics-event';
import { SiteAnalyticsStore } from './analytics-store.service';

describe('persistent website DuckDB', () => {
  let store: SiteAnalyticsStore;
  let dir: string;
  let config: ConfigService;
  const sessionId = randomUUID(),
    pageId = randomUUID();
  const context = {
    ip: '192.0.2.1',
    ua: 'Mozilla/5.0 Chrome/123 Safari/537',
    country: 'IN',
  };
  const now = Date.now();
  const from = new Date(now).toISOString().slice(0, 10),
    to = new Date(now + 86400_000).toISOString().slice(0, 10);
  const make = (extra: Record<string, unknown> = {}) =>
    validateBatch({
      version: 1,
      events: [
        {
          id: randomUUID(),
          sessionId,
          pageId,
          kind: 'pageview',
          name: 'pageview',
          timestamp: now,
          path: '/projects',
          hostname: 'www.majestanrealty.com',
          ...extra,
        },
      ],
    })[0];
  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'majestan-site-analytics-'));
    config = new ConfigService({
      SITE_ANALYTICS_ENABLED: true,
      SITE_ANALYTICS_SECRET: 'x'.repeat(40),
      INTERNAL_API_KEY: 'internal',
      SITE_ANALYTICS_DB_PATH: join(dir, 'site.duckdb'),
      SITE_ANALYTICS_RETENTION_DAYS: 180,
    });
    store = new SiteAnalyticsStore(config);
    await store.onModuleInit();
  });
  afterEach(async () => {
    await store.onApplicationShutdown();
    rmSync(dir, { recursive: true, force: true });
  });
  it('commits, deduplicates retries, preserves data across reopen, and computes metrics', async () => {
    const page = make();
    await Promise.all([
      store.ingest([page], context),
      store.ingest([page], context),
    ]);
    // Late engagement arrives out of order: MAX cumulative values, never SUM.
    await store.ingest(
      [
        make({
          kind: 'engagement',
          name: 'leave',
          durationMs: 15000,
          scrollPercent: 75,
        }),
        make({
          kind: 'engagement',
          name: 'heartbeat',
          durationMs: 5000,
          scrollPercent: 25,
        }),
        make({ kind: 'conversion', name: 'enquiry_submitted' }),
        make({
          kind: 'web_vital',
          name: 'LCP',
          value: 2100,
          rating: 'good',
          metricId: 'v5-lcp',
        }),
      ],
      context,
    );
    await store.onApplicationShutdown();
    store = new SiteAnalyticsStore(config);
    await store.onModuleInit();
    const report = await store.report(from, to);
    expect(report.overview.pageviews).toBe('1');
    expect(Number(report.overview.engaged_ms)).toBe(15000);
    expect(report.performance[0]).toMatchObject({ name: 'LCP', p75: 2100 });
    expect(report.events.some((e) => e.name === 'enquiry_submitted')).toBe(
      true,
    );
    expect((await store.status()).ready).toBe(true);
    await store.maintenance(true);
    expect(readFileSync(join(dir, 'parquet', 'views.sql'), 'utf8')).toContain(
      'site_daily.parquet',
    );
  });
  it('rejects invalid report windows', async () => {
    await expect(store.report('2026-02-30', '2026-03-04')).rejects.toThrow(
      'valid UTC dates',
    );
    await expect(store.report('2026-01-01', '2026-11-06')).rejects.toThrow();
  });
  it('is inactive when disabled and refuses writes', async () => {
    const disabled = new SiteAnalyticsStore(
      new ConfigService({ SITE_ANALYTICS_ENABLED: false }),
    );
    await disabled.onModuleInit();
    expect(await disabled.status()).toMatchObject({
      enabled: false,
      available: false,
      ready: false,
    });
    await expect(disabled.ingest([make()], context)).rejects.toThrow(
      'unavailable',
    );
  });

  it.each(['secret', 'key', 'path', 'database', 'schema'])(
    'initializes without taking the API down when analytics fails at %s',
    async (failure) => {
      const log = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => {});
      const values = {
        SITE_ANALYTICS_ENABLED: true,
        SITE_ANALYTICS_SECRET: 'x'.repeat(40),
        INTERNAL_API_KEY: 'key',
        SITE_ANALYTICS_DB_PATH: join(dir, 'failure.duckdb'),
      };
      if (failure === 'secret') values.SITE_ANALYTICS_SECRET = '';
      if (failure === 'key') values.INTERNAL_API_KEY = '';
      if (failure === 'path') {
        writeFileSync(join(dir, 'blocked'), 'file');
        values.SITE_ANALYTICS_DB_PATH = join(dir, 'blocked', 'site.duckdb');
      }
      const close = jest.fn();
      const create =
        failure === 'database'
          ? jest
              .spyOn(DuckDBInstance, 'create')
              .mockRejectedValueOnce(new Error('locked'))
          : failure === 'schema'
            ? jest.spyOn(DuckDBInstance, 'create').mockResolvedValueOnce({
                connect: async () => ({
                  run: async () => {
                    throw new Error('schema failed');
                  },
                  closeSync: jest.fn(),
                }),
                closeSync: close,
              } as unknown as DuckDBInstance)
            : null;
      const unavailable = new SiteAnalyticsStore(new ConfigService(values));
      try {
        await expect(unavailable.onModuleInit()).resolves.toBeUndefined();
        expect(await unavailable.status()).toMatchObject({
          enabled: true,
          available: false,
          reason: expect.any(String),
        });
        await expect(
          unavailable.ingest([make()], context),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);
        try {
          await unavailable.ingest([make()], context);
        } catch (error) {
          expect((error as ServiceUnavailableException).getStatus()).toBe(503);
        }
        expect(log).toHaveBeenCalledTimes(1);
        if (failure === 'schema') expect(close).toHaveBeenCalledTimes(1);
      } finally {
        await unavailable.onApplicationShutdown();
        create?.mockRestore();
        log.mockRestore();
      }
    },
  );

  it('exports only dirty data, at most hourly, and runs retention daily', async () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    const instance = (store as any).instance as DuckDBInstance;
    const connect = jest.spyOn(instance, 'connect');
    const exports = jest.spyOn(store as any, 'exportSnapshots');
    try {
      await store.ingest([make()], context);
      await store.maintenance();
      expect(exports).toHaveBeenCalledTimes(1);
      await store.ingest([make()], context);
      clock.mockReturnValue(now + 600_000);
      connect.mockClear();
      await store.maintenance();
      expect(connect).not.toHaveBeenCalled();
      clock.mockReturnValue(now + 3600_000);
      await store.maintenance();
      expect(exports).toHaveBeenCalledTimes(2);
      clock.mockReturnValue(now + 7200_000);
      connect.mockClear();
      await store.maintenance();
      expect(connect).not.toHaveBeenCalled();
      clock.mockReturnValue(now + 86400_000);
      await store.maintenance();
      expect(connect).toHaveBeenCalledTimes(1);
      expect(exports).toHaveBeenCalledTimes(2);
    } finally {
      clock.mockRestore();
      exports.mockRestore();
      connect.mockRestore();
    }
  });

  it('ingests while an export is blocked and waits for maintenance on shutdown', async () => {
    await store.ingest([make()], context);
    let release!: () => void;
    let started!: () => void;
    const began = new Promise<void>((resolve) => {
      started = resolve;
    });
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const exports = jest
      .spyOn(store as any, 'exportSnapshots')
      .mockImplementation(async () => {
        started();
        await blocked;
      });
    const maintenance = store.maintenance();
    await began;
    try {
      await expect(store.ingest([make()], context)).resolves.toMatchObject({
        accepted: 1,
      });
      let stopped = false;
      const shutdown = store.onApplicationShutdown().then(() => {
        stopped = true;
      });
      await Promise.resolve();
      expect(stopped).toBe(false);
      release();
      await maintenance;
      await shutdown;
      expect(stopped).toBe(true);
    } finally {
      release();
      exports.mockRestore();
    }
  });
});
