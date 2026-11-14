import {
  Injectable,
  Optional,
  Logger,
  OnModuleInit,
  OnApplicationShutdown,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { AnalyticsEvent } from './analytics-event';
import { deviceInfo, pageRoute, visitorId } from './analytics-event';
import { ANALYTICS_SCHEMA } from './analytics-schema';
import { openCompacted } from './analytics-compaction';

export type AnalyticsContext = { ip: string; ua: string; country?: string };
const COLUMNS = [
  'id',
  'session_id',
  'page_id',
  'visitor_id',
  'kind',
  'name',
  'occurred_at',
  'hostname',
  'path',
  'route',
  'referrer',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'browser',
  'os',
  'device',
  'country',
  'language',
  'timezone',
  'viewport_width',
  'viewport_height',
  'screen_width',
  'screen_height',
  'duration_ms',
  'scroll_percent',
  'value',
  'rating',
  'metric_id',
  'target_host',
  'entity_id',
  'entity_kind',
  'status_code',
];

@Injectable()
export class SiteAnalyticsStore implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(SiteAnalyticsStore.name);
  private instance: DuckDBInstance | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private pending = 0;
  private closing = false;
  private timer?: ReturnType<typeof setInterval>;
  private snapshotDir?: string;
  private lastRetentionAt = 0;
  private lastExportAt = 0;
  private eventVersion = 0;
  private exportedVersion = 0;
  private unavailableReason: string | null = null;
  private lastExport: string | null = null;
  private maintenanceTask: Promise<void> | null = null;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly catalog?: DataSource,
  ) {}

  get enabled() {
    return (
      String(this.config.get('SITE_ANALYTICS_ENABLED', 'false')) === 'true'
    );
  }

  async onModuleInit() {
    if (!this.enabled) return;
    let candidate: DuckDBInstance | null = null;
    let reason =
      'Missing SITE_ANALYTICS_SECRET (32+ characters) or INTERNAL_API_KEY';
    try {
      if (
        String(this.config.get('SITE_ANALYTICS_SECRET', '')).length < 32 ||
        !this.config.get('INTERNAL_API_KEY')
      ) {
        throw new Error(reason);
      }
      reason = 'Unable to create analytics storage directories';
      const path = this.config.get<string>(
        'SITE_ANALYTICS_DB_PATH',
        './data/site-analytics/site.duckdb',
      );
      if (path !== ':memory:') {
        mkdirSync(dirname(path), { recursive: true });
        this.snapshotDir = join(dirname(path), 'parquet');
        mkdirSync(this.snapshotDir, { recursive: true });
      }
      reason =
        'Unable to open analytics DuckDB (check file permissions, locks and integrity)';
      const open = () =>
        DuckDBInstance.create(path, { threads: '2', memory_limit: '256MB' });
      // Rewrites the file first when it is mostly deleted row versions.
      candidate =
        path === ':memory:'
          ? await open()
          : await openCompacted(path, open, this.logger);
      reason = 'Unable to initialize analytics schema';
      const conn = await candidate.connect();
      try {
        await conn.run(ANALYTICS_SCHEMA);
      } finally {
        conn.closeSync();
      }
      this.instance = candidate;
      this.unavailableReason = null;
      this.timer = setInterval(() => {
        void this.maintenance().catch(() =>
          this.logger.error('Site analytics maintenance failed'),
        );
      }, 60_000);
      this.timer.unref?.();
    } catch {
      this.instance = null;
      this.unavailableReason = reason;
      try {
        candidate?.closeSync();
      } catch {
        /* Preserve the original initialization failure. */
      }
      this.logger.error(
        `Site analytics unavailable: ${reason}. Site API will continue without analytics.`,
      );
    }
  }

  private readonly reportingTasks = new Set<Promise<unknown>>();
  reporting<T>(work: (connection: DuckDBConnection) => Promise<T>): Promise<T> {
    if (!this.instance || this.closing || this.reportingTasks.size >= 16)
      return Promise.reject(
        new ServiceUnavailableException('Analytics reporting unavailable'),
      );
    const instance = this.instance;
    const task = (async () => {
      const conn = await instance.connect();
      try {
        return await work(conn);
      } finally {
        conn.closeSync();
      }
    })();
    this.reportingTasks.add(task);
    void task.finally(() => this.reportingTasks.delete(task)).catch(() => {});
    return task;
  }

  /** One writer per file; acknowledge ingestion only after its transaction commits. */
  private enqueue<T>(work: (conn: DuckDBConnection) => Promise<T>): Promise<T> {
    if (!this.instance || this.closing || this.pending >= 100)
      throw new ServiceUnavailableException('Site analytics unavailable');
    this.pending++;
    const run = this.tail.then(async () => {
      const conn = await this.instance!.connect();
      try {
        return await work(conn);
      } finally {
        conn.closeSync();
      }
    });
    this.tail = run
      .catch(() => {})
      .finally(() => {
        this.pending--;
      });
    return run;
  }

  async ingest(events: AnalyticsEvent[], context: AnalyticsContext) {
    if (!this.instance || this.closing)
      throw new ServiceUnavailableException('Site analytics unavailable');
    const info = deviceInfo(context.ua);
    const visitor = visitorId(
      this.config.getOrThrow<string>('SITE_ANALYTICS_SECRET'),
      context.ip,
      context.ua,
    );
    const country = /^[A-Z]{2}$/.test(context.country ?? '')
      ? context.country!
      : null;
    const rows = events.map((e) => [
      e.id,
      e.sessionId,
      e.pageId,
      visitor,
      e.kind,
      e.name,
      new Date(e.timestamp).toISOString(),
      e.hostname,
      e.path,
      pageRoute(e.path),
      e.referrer ?? null,
      e.utmSource ?? null,
      e.utmMedium ?? null,
      e.utmCampaign ?? null,
      info.browser,
      info.os,
      info.device,
      country,
      e.language ?? null,
      e.timezone ?? null,
      e.viewportWidth ?? null,
      e.viewportHeight ?? null,
      e.screenWidth ?? null,
      e.screenHeight ?? null,
      e.durationMs ?? null,
      e.scrollPercent ?? null,
      e.value ?? null,
      e.rating ?? null,
      e.metricId ?? null,
      e.targetHost ?? null,
      e.entityId ?? null,
      e.entityKind ?? null,
      e.statusCode ?? null,
    ]);
    await this.enqueue(async (conn) => {
      await conn.run('BEGIN TRANSACTION');
      try {
        const values = rows
          .map(() => `(${COLUMNS.map(() => '?').join(',')})`)
          .join(',');
        await conn.run(
          `INSERT INTO site_events (${COLUMNS.join(',')}) VALUES ${values} ON CONFLICT DO NOTHING`,
          rows.flat() as never,
        );
        await conn.run('COMMIT');
        this.eventVersion++;
      } catch (error) {
        await conn.run('ROLLBACK');
        throw error;
      }
    });
    return { accepted: events.length }; // Retried IDs are harmless, not new events.
  }

  private validateRange(from: string, to: string) {
    const start = Date.parse(from),
      end = Date.parse(to);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(to) ||
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start >= end ||
      end - start > 366 * 86400_000 ||
      new Date(start).toISOString().slice(0, 10) !== from ||
      new Date(end).toISOString().slice(0, 10) !== to
    ) {
      throw new BadRequestException(
        'Use valid UTC dates from < to, at most 366 days (to is exclusive)',
      );
    }
  }
  async propertyInsights(from: string, to: string) {
    this.validateRange(from, to);
    if (!this.catalog || this.closing)
      throw new ServiceUnavailableException('Insights unavailable');
    type Alias = {
      path: string | null;
      kind: string;
      id: string;
      title: string;
      status?: string;
      city?: string;
      category?: string;
      created?: Date | string;
    };
    const [configured, properties, projects] = await Promise.all([
      this.catalog.query<
        Alias[]
      >(`SELECT c.public_path path,c.scope kind,CAST(COALESCE(p.id,j.id) AS CHAR) id,COALESCE(p.title,j.name) title
        FROM seo_configs c LEFT JOIN properties p ON c.scope='property' AND p.id=c.property_id
        LEFT JOIN projects j ON c.scope='project' AND j.id=c.project_id
        WHERE c.public_path IS NOT NULL AND (p.id IS NOT NULL OR j.id IS NOT NULL)`),
      this.catalog.query<Alias[]>(
        "SELECT slug path,'property' kind,id,title,status,city,property_type category,created_at created FROM properties",
      ),
      this.catalog.query<(Alias & { slug: string })[]>(
        "SELECT canonical_slug path,'project' kind,id,name title,slug,status,city,project_type category,created_at created FROM projects",
      ),
    ]);
    const aliases = [
      ...configured,
      ...properties
        .filter((r) => r.path)
        .flatMap((r) => [
          { ...r, path: '/' + r.path!.replace(/^\/+/, '') },
          { ...r, path: '/property/' + r.path },
        ]),
      ...projects.flatMap((r) => [
        { ...r, path: '/' + r.path!.replace(/^\/+/, '') },
        { ...r, path: '/projects/' + r.slug },
      ]),
    ];
    const inventory = [...properties, ...projects];
    const snapshot = ['property', 'project'].map((kind) => {
      const records = inventory.filter((r) => r.kind === kind);
      const breakdown = (field: 'status' | 'city' | 'category') => {
        const counts = new Map<string, number>();
        for (const row of records) {
          const label = row[field]?.trim() || 'Unspecified';
          counts.set(label, (counts.get(label) || 0) + 1);
        }
        return [...counts]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
      };
      const additions = new Map<string, number>();
      for (const row of records) {
        if (!row.created) continue;
        const date = new Date(row.created);
        if (!Number.isFinite(date.getTime())) continue;
        const day = date.toISOString().slice(0, 10);
        if (day >= from && day < to)
          additions.set(day, (additions.get(day) || 0) + 1);
      }
      return {
        kind,
        total: records.length,
        status: breakdown('status'),
        city: breakdown('city'),
        category: breakdown('category'),
        additions: [...additions]
          .map(([day, count]) => ({ day, count }))
          .sort((a, b) => a.day.localeCompare(b.day)),
      };
    });
    const snapshotAt = new Date().toISOString();
    if (!this.instance)
      return { rows: [], snapshot, snapshotAt, trafficAvailable: false };
    const conn = await this.instance.connect();
    try {
      const result = await conn.runAndReadAll(
        `
        WITH aliases AS (SELECT unnest(from_json(?, '[{"path":"VARCHAR","kind":"VARCHAR","id":"VARCHAR","title":"VARCHAR"}]'),recursive:=true)),
        catalog AS (SELECT lower(rtrim(path,'/')) path,first(kind) kind,first(id) id,first(title) title FROM aliases GROUP BY 1 HAVING count(DISTINCT kind||':'||id)=1),
        actions AS (SELECT page_id,count(*) FILTER(WHERE kind='conversion' AND name<>'registration_completed') conversions,count(*) FILTER(WHERE kind='interaction') interactions
          FROM site_events WHERE kind IN ('conversion','interaction') AND occurred_at>=?::DATE AND occurred_at<?::DATE GROUP BY 1),
        matched AS (SELECT c.kind,c.id,c.title,v.visitor_id,v.session_id,v.engaged_ms,v.max_scroll_percent,
          strftime(v.occurred_at,'%Y-%m-%d') AS "day",coalesce(a.conversions,0) conversions,coalesce(a.interactions,0) interactions
          FROM site_page_views v JOIN catalog c ON c.path=lower(CASE WHEN regexp_full_match(v.path,'/projects/[^/]+/[^/]+/?') THEN '/projects/'||split_part(v.path,'/',4) ELSE rtrim(v.path,'/') END)
          LEFT JOIN actions a USING(page_id) WHERE v.occurred_at>=?::DATE AND v.occurred_at<?::DATE)
        SELECT kind,id,title,day,count(*) AS "views",count(DISTINCT visitor_id) visitors,count(DISTINCT session_id) sessions,
          avg(engaged_ms) engagement,avg(max_scroll_percent) AS "scroll",sum(conversions) conversions,sum(interactions) interactions
        FROM matched GROUP BY GROUPING SETS ((kind,id,title),(kind,day)) ORDER BY views DESC`,
        [JSON.stringify(aliases), from, to, from, to],
      );
      return {
        rows: result.getRowObjectsJson(),
        snapshot,
        snapshotAt,
        trafficAvailable: true,
      };
    } finally {
      conn.closeSync();
    }
  }
  async report(from: string, to: string) {
    this.validateRange(from, to);
    return this.enqueue(async (conn) => {
      const query = async (sql: string, params: unknown[] = [from, to]) => {
        const result = await conn.runAndReadAll(sql, params as never);
        return result.getRowObjectsJson();
      };
      const when =
        'occurred_at >= CAST(? AS TIMESTAMP) AND occurred_at < CAST(? AS TIMESTAMP)';
      const [overview] =
        await query(`SELECT count(*) pageviews,count(DISTINCT visitor_id) visitors,count(DISTINCT session_id) sessions,
        coalesce(sum(engaged_ms),0) engaged_ms FROM site_page_views WHERE ${when}`);
      const [sessionStats] =
        await query(`SELECT count(*) started_sessions,coalesce(sum(CASE WHEN pageviews=1 THEN 1 ELSE 0 END),0) bounced_sessions,
        coalesce(avg(CASE WHEN pageviews=1 THEN 1.0 ELSE 0.0 END),0) bounce_rate,
        coalesce(avg(pageviews),0) pages_per_session,coalesce(avg(engaged_ms),0) avg_engagement_ms
        FROM site_sessions WHERE started_at>=CAST(? AS TIMESTAMP) AND started_at<CAST(? AS TIMESTAMP)`);
      const dimensions: Record<string, unknown> = {};
      for (const column of [
        'path',
        'route',
        'hostname',
        'referrer',
        'utm_source',
        'utm_medium',
        'utm_campaign',
        'country',
        'browser',
        'os',
        'device',
        'language',
        'timezone',
      ]) {
        dimensions[column] =
          await query(`SELECT coalesce(${column},'(unknown)') AS "label",count(*) pageviews,count(DISTINCT visitor_id) visitors,
          coalesce(avg(engaged_ms),0) avg_engagement_ms FROM site_page_views WHERE ${when} GROUP BY 1 ORDER BY pageviews DESC,1 LIMIT 100`);
      }
      return {
        from,
        to,
        timezone: 'UTC',
        overview: { ...overview, ...sessionStats },
        timeseries: await query(
          `SELECT strftime(occurred_at,'%Y-%m-%d') AS "day",count(*) pageviews,count(DISTINCT visitor_id) visitors,count(DISTINCT session_id) sessions FROM site_page_views WHERE ${when} GROUP BY 1 ORDER BY 1`,
        ),
        dimensions,
        entries: await query(
          `SELECT entry_path path,count(*) sessions FROM site_sessions WHERE started_at>=CAST(? AS TIMESTAMP) AND started_at<CAST(? AS TIMESTAMP) GROUP BY 1 ORDER BY sessions DESC LIMIT 100`,
        ),
        exits: await query(
          `SELECT exit_path path,count(*) sessions FROM site_sessions WHERE started_at>=CAST(? AS TIMESTAMP) AND started_at<CAST(? AS TIMESTAMP) GROUP BY 1 ORDER BY sessions DESC LIMIT 100`,
        ),
        events: await query(
          // Registrations no longer count as conversions; stale cached
          // frontends still send them, so exclude by name here.
          `SELECT kind,name,count(*) events,count(DISTINCT session_id) sessions FROM site_events WHERE ${when} AND kind IN ('interaction','conversion','error') AND NOT (kind='conversion' AND name='registration_completed') GROUP BY 1,2 ORDER BY events DESC`,
        ),
        performance:
          await query(`SELECT name,count(*) samples,quantile_cont(value,0.75) p75,quantile_cont(value,0.5) p50,
          quantile_cont(value,0.95) p95,count(*) FILTER (WHERE rating='good') good_samples FROM site_vitals WHERE ${when} GROUP BY name`),
        realtime: await query(
          `SELECT count(DISTINCT visitor_id) visitors,count(*) pageviews FROM site_events WHERE kind='pageview' AND received_at > current_timestamp - INTERVAL '5 minutes'`,
          [],
        ),
      };
    });
  }

  async status() {
    if (!this.instance)
      return {
        enabled: this.enabled,
        available: false,
        ready: false,
        reason: this.unavailableReason,
      };
    return this.enqueue(async (conn) => {
      const result = await conn.runAndReadAll(
        'SELECT count(*) events,max(received_at)::VARCHAR last_received_at FROM site_events',
      );
      return {
        enabled: true,
        available: true,
        ready: true,
        ...result.getRowObjectsJson()[0],
        pending: this.pending,
        lastExport: this.lastExport,
      };
    });
  }

  maintenance(force = false): Promise<void> {
    if (!this.instance || this.closing) return Promise.resolve();
    if (this.maintenanceTask) return this.maintenanceTask;
    this.maintenanceTask = this.runMaintenance(force).finally(() => {
      this.maintenanceTask = null;
    });
    return this.maintenanceTask;
  }

  private async runMaintenance(force: boolean) {
    const now = Date.now();
    const retain = force || now - this.lastRetentionAt >= 24 * 3600_000;
    const exportDue =
      !!this.snapshotDir &&
      (force ||
        (this.eventVersion !== this.exportedVersion &&
          now - this.lastExportAt >= 3600_000));
    if (!retain && !exportDue) return;
    // A separate MVCC connection avoids putting ingestion behind full exports.
    // Shutdown waits for this task before closing the shared instance.
    const conn = await this.instance!.connect();
    try {
      if (retain) {
        const days = this.config.get<number>(
          'SITE_ANALYTICS_RETENTION_DAYS',
          180,
        );
        await conn.run(
          "DELETE FROM site_events WHERE occurred_at < current_timestamp - CAST(? AS INTEGER) * INTERVAL '1 day'",
          [days],
        );
        this.lastRetentionAt = now;
      }
      if (exportDue) {
        // Capture BEFORE exporting: writes during the export keep it dirty.
        const version = this.eventVersion;
        await this.exportSnapshots(conn);
        this.exportedVersion = version;
        this.lastExportAt = now;
        this.lastExport = new Date().toISOString();
      }
    } finally {
      conn.closeSync();
    }
  }

  private async exportSnapshots(conn: DuckDBConnection) {
    const names = ['site_daily', 'site_sessions', 'site_vitals'];
    for (const table of names) {
      const file = join(this.snapshotDir!, `${table}.parquet`);
      await conn.run(
        `COPY (SELECT * FROM ${table}) TO '${(file + '.tmp').replace(/'/g, "''")}' (FORMAT parquet)`,
      );
      renameSync(file + '.tmp', file);
    }
    writeFileSync(
      join(this.snapshotDir!, 'views.sql.tmp'),
      names
        .map((t) => `CREATE OR REPLACE VIEW ${t} AS FROM '${t}.parquet';`)
        .join('\n') + '\n',
    );
    renameSync(
      join(this.snapshotDir!, 'views.sql.tmp'),
      join(this.snapshotDir!, 'views.sql'),
    );
  }

  async onApplicationShutdown() {
    this.closing = true;
    if (this.timer) clearInterval(this.timer);
    await this.tail;
    await this.maintenanceTask?.catch(() => {});
    await Promise.allSettled([...this.reportingTasks]);
    if (this.instance) {
      const checkpoint = await this.instance.connect();
      try {
        await checkpoint.run('CHECKPOINT');
      } catch {
        this.logger.warn('Analytics checkpoint deferred to journal recovery');
      } finally {
        checkpoint.closeSync();
      }
    }
    this.instance?.closeSync();
    this.instance = null;
  }
}
