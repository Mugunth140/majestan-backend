import {
  BadRequestException,
  Injectable,
  Logger,
  Optional,
  OnApplicationBootstrap,
  OnApplicationShutdown,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { SiteAnalyticsStore } from '../analytics-store.service';
import { INVENTORY_ANALYTICS_SCHEMA } from '../analytics-schema';
import { loadInventory } from './inventory-source';
import {
  InventoryFilters,
  InventoryRecord,
  TrafficRow,
} from './inventory.types';
import {
  filterInventory,
  configurationMatches,
  issueIndex,
  sectionReport,
  validateInventoryFilters,
} from './inventory-model';

type HistoryEvent = {
  id: number;
  kind: string;
  listing_id: number;
  subject: string;
  subject_id: number;
  action: string;
  before_json: unknown;
  after_json: unknown;
  occurred_at: Date | string;
};
type Enquiry = {
  key: string;
  day: string;
  enquiries: number;
  visits: number;
  linkedEnquirySessions: number;
  linkedSubmissions: number;
};
const sqlDate = (value: Date | string) =>
  new Date(value).toISOString().slice(0, 23).replace('T', ' ');
const decode = <T>(value: unknown): T =>
  typeof value === 'string' ? (JSON.parse(value) as T) : (value as T);
@Injectable()
export class InventoryInsightsService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(InventoryInsightsService.name);
  private records: InventoryRecord[] = [];
  private syncedAt: string | null = null;
  private syncError: string | null = null;
  private historyError: string | null = null;
  private historyAvailable = false;
  private refreshing: Promise<void> | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private stopped = false;
  private lastPrunedDay = '';
  /** Fingerprint of the records last written to inventory_current by this process. */
  private writtenFingerprint: string | null = null;
  /** UTC day alias last_seen was last refreshed for. */
  private aliasDay = '';
  private readonly cache = new Map<string, { at: number; data: unknown }>();
  constructor(
    @Optional() private readonly db: DataSource,
    private readonly analytics: SiteAnalyticsStore,
  ) {}
  onApplicationBootstrap() {
    void this.refresh().catch(() => {});
    this.timer = setInterval(() => void this.refresh().catch(() => {}), 300000);
  }
  async onApplicationShutdown() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    await this.refreshing?.catch(() => {});
  }
  async refresh(force = false) {
    if (this.stopped)
      throw new ServiceUnavailableException('Insights are stopping');
    if (this.refreshing) return this.refreshing;
    if (
      !force &&
      this.syncedAt &&
      Date.now() - Date.parse(this.syncedAt) <
        (this.historyAvailable ? 300000 : 5000)
    )
      return;
    this.refreshing = this.rebuild().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }
  private async rebuild() {
    try {
      if (!this.db)
        throw new ServiceUnavailableException('Inventory source unavailable');
      const records = await loadInventory(this.db);
      const now = new Date().toISOString();
      // Redirect aliases are resolved only to verified inventory paths, never by ID-shaped heuristics.
      const redirects = await this.db.query<
        { source: string; destination: string }[]
      >(
        'SELECT source_path source,destination_path destination FROM seo_redirects WHERE is_active=1',
      );
      for (const r of records) {
        const paths = new Set(r.aliases);
        for (let depth = 0; depth < 10; depth++) {
          const before = paths.size;
          redirects.forEach((a) => {
            if (paths.has(a.destination)) paths.add(a.source);
          });
          if (paths.size === before) break;
        }
        r.aliases = [...paths];
      }
      this.records = records;
      this.syncedAt = now;
      this.syncError = null;
      this.cache.clear();
      try {
        await this.analytics.reporting(async (c) => {
          await c.run(INVENTORY_ANALYTICS_SCHEMA);
          const cursor = await c.runAndReadAll(
            'SELECT coalesce(max(id),0) id FROM inventory_events',
          );
          const id = Number(cursor.getRowObjectsJson()[0]?.id || 0);
          const changes = await this.db.query<HistoryEvent[]>(
            "SELECT id,kind,listing_id,subject,subject_id,action,before_json,after_json,DATE_FORMAT(occurred_at,'%Y-%m-%dT%H:%i:%s.%fZ') occurred_at FROM analytics_inventory_events WHERE id>? ORDER BY id LIMIT 10000",
            [id],
          );
          const day = now.slice(0, 10);
          const fingerprint = createHash('sha1')
            .update(JSON.stringify(records))
            .digest('hex');
          // DuckDB keeps every deleted row version, so rewriting ~2k unchanged rows every
          // five minutes grew the file by gigabytes. Write only what changed.
          const recordsChanged = fingerprint !== this.writtenFingerprint;
          const newAliasDay = day !== this.aliasDay;
          await c.run('BEGIN TRANSACTION');
          try {
            if (recordsChanged) {
              // Replacing the table drops its storage outright; DELETE would keep the old rows.
              await c.run(
                'CREATE OR REPLACE TABLE inventory_current (key VARCHAR PRIMARY KEY,record JSON NOT NULL,synced_at TIMESTAMP NOT NULL)',
              );
            }
            for (let i = 0; recordsChanged && i < records.length; i += 200) {
              const chunk = records.slice(i, i + 200);
              await c.run(
                'INSERT INTO inventory_current VALUES ' +
                  chunk.map(() => '(?,?,?::TIMESTAMP)').join(','),
                chunk.flatMap((r) => [r.key, JSON.stringify(r), sqlDate(now)]),
              );
            }
            await c.run(
              "INSERT INTO inventory_meta VALUES ('current_refreshed',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
              [now],
            );
            // One immutable capture per UTC day; baseline time is exposed to clients.
            await c.run(
              'INSERT INTO inventory_snapshots SELECT ?::DATE,key,record,?::TIMESTAMP FROM inventory_current WHERE NOT EXISTS(SELECT 1 FROM inventory_snapshot_runs WHERE day=?::DATE)',
              [day, sqlDate(now), day],
            );
            await c.run(
              'INSERT INTO inventory_snapshot_runs VALUES (?::DATE,?::TIMESTAMP) ON CONFLICT DO NOTHING',
              [day, sqlDate(now)],
            );
            const aliasRows = (
              recordsChanged || newAliasDay ? records : []
            ).flatMap((r) =>
              r.aliases.map((a) => [
                a.toLowerCase().replace(/\/$/, ''),
                r.key,
                sqlDate(now),
                sqlDate(now),
              ]),
            );
            for (const e of changes) {
              if (
                e.subject !== 'listing' ||
                (e.kind === 'property' && Number(e.listing_id) === 999)
              )
                continue;
              for (const state of [e.before_json, e.after_json]) {
                if (!state) continue;
                const value = decode<Record<string, unknown>>(state);
                const slug = typeof value.slug === 'string' ? value.slug : null;
                const canonical =
                  typeof value.canonical_slug === 'string'
                    ? value.canonical_slug
                    : slug;
                const city =
                  typeof value.city === 'string'
                    ? value.city.toLowerCase().replace(/\s+/g, '-')
                    : null;
                const paths = [
                  canonical ? '/' + canonical : null,
                  slug
                    ? '/' +
                      (e.kind === 'property' ? 'property/' : 'projects/') +
                      slug
                    : null,
                  e.kind === 'project' && city && slug
                    ? '/projects/' + city + '/' + slug
                    : null,
                ].filter((a): a is string => !!a);
                for (const a of paths)
                  for (const path of [
                    a,
                    ...[
                      'amenities',
                      'floor-plan',
                      'locality',
                      'photos',
                      'faqs',
                      'specifications',
                      'price',
                      'videos',
                      'map',
                    ].map((s) => a + '/' + s),
                  ])
                    aliasRows.push([
                      path.toLowerCase().replace(/\/$/, ''),
                      e.kind + ':' + e.listing_id,
                      sqlDate(e.occurred_at),
                      sqlDate(now),
                    ]);
              }
            }
            for (let offset = 0; offset < aliasRows.length; offset += 200) {
              const chunk = aliasRows.slice(offset, offset + 200);
              await c.run(
                'INSERT INTO inventory_aliases VALUES ' +
                  chunk.map(() => '(?,?,?::TIMESTAMP,?::TIMESTAMP)').join(',') +
                  // Updating a row stores a new version of it; refresh last_seen once a day.
                  (newAliasDay
                    ? ' ON CONFLICT(path,key) DO UPDATE SET last_seen=excluded.last_seen'
                    : ' ON CONFLICT DO NOTHING'),
                chunk.flat(),
              );
            }
            for (const e of changes)
              await c.run(
                'INSERT INTO inventory_events VALUES (?,?,?,?,?,?,?,?,?::TIMESTAMP) ON CONFLICT DO NOTHING',
                [
                  e.id,
                  e.kind,
                  e.listing_id,
                  e.subject,
                  e.subject_id,
                  e.action,
                  e.before_json
                    ? JSON.stringify(decode<unknown>(e.before_json))
                    : null,
                  e.after_json
                    ? JSON.stringify(decode<unknown>(e.after_json))
                    : null,
                  sqlDate(e.occurred_at),
                ],
              );
            await c.run(
              "INSERT INTO inventory_meta VALUES ('baseline',?) ON CONFLICT DO NOTHING",
              [now],
            );
            await c.run(
              "DELETE FROM inventory_snapshots WHERE day<current_date-INTERVAL '24 months'",
            );
            await c.run(
              "DELETE FROM inventory_snapshot_runs WHERE day<current_date-INTERVAL '24 months'",
            );
            await c.run(
              "DELETE FROM inventory_events WHERE occurred_at<current_timestamp-INTERVAL '24 months'",
            );
            await c.run('COMMIT');
            this.writtenFingerprint = fingerprint;
            this.aliasDay = day;
          } catch (error) {
            await c.run('ROLLBACK');
            this.writtenFingerprint = null;
            throw error;
          }
        });
        this.historyAvailable = true;
        if (this.lastPrunedDay !== now.slice(0, 10)) {
          await this.db.query(
            'DELETE FROM analytics_inventory_events WHERE occurred_at<UTC_TIMESTAMP()-INTERVAL 24 MONTH LIMIT 10000',
          );
          this.lastPrunedDay = now.slice(0, 10);
        }
        this.historyError = null;
      } catch (error) {
        this.historyAvailable = false;
        this.historyError =
          'Inventory is current; history projection is unavailable';
        this.logger.warn(
          this.historyError +
            ': ' +
            (error instanceof Error ? error.message : 'storage error'),
        );
      }
    } catch {
      this.syncError = 'Inventory source could not refresh';
      this.logger.warn(this.syncError);
      if (!this.syncedAt) {
        await this.analytics
          .reporting(async (c) => {
            const state = await c.runAndReadAll(
              "SELECT value FROM inventory_meta WHERE key='current_refreshed'",
            );
            const at = state.getRowObjectsJson()[0]?.value;
            if (typeof at !== 'string') return;
            const saved = await c.runAndReadAll(
              'SELECT record FROM inventory_current',
            );
            this.records = saved
              .getRowObjectsJson()
              .map((row) => decode<InventoryRecord>(row.record));
            this.syncedAt = at;
            this.historyAvailable = true;
          })
          .catch(() => {});
      }
      if (!this.syncedAt) throw new ServiceUnavailableException(this.syncError);
    }
  }
  private async snapshot(filters: InventoryFilters) {
    // A rebuild takes several seconds; once a list exists, answer from it and rebuild in the
    // background so a request never waits on one (the CRM gives up after 8 seconds).
    if (this.syncedAt) void this.refresh().catch(() => {});
    else await this.refresh();
    if (!filters.asOf) return this.records;
    if (!this.historyAvailable)
      throw new ServiceUnavailableException(
        'Historical inventory is unavailable',
      );
    return this.analytics.reporting(async (c) => {
      const dates = await c.runAndReadAll(
        'SELECT day FROM inventory_snapshot_runs WHERE day=?::DATE',
        [filters.asOf!],
      );
      if (!dates.getRowObjectsJson().length)
        throw new BadRequestException(
          'No inventory snapshot exists for this date',
        );
      const rows = await c.runAndReadAll(
        'SELECT record FROM inventory_snapshots WHERE day=?::DATE',
        [filters.asOf!],
      );
      return rows
        .getRowObjectsJson()
        .map((r) => decode<InventoryRecord>(r.record));
    });
  }
  private async traffic(f: InventoryFilters, records: InventoryRecord[]) {
    const empty = {
      available: false,
      rows: [] as TrafficRow[],
      unmatched: 0,
      first: null as string | null,
    };
    try {
      return await this.analytics.reporting(async (c) => {
        const rows = await c.runAndReadAll(
          `WITH aliases AS (SELECT path,first(key) AS "key" FROM inventory_aliases GROUP BY path HAVING count(DISTINCT key)=1),
        pages AS (SELECT p.*,a.key listing_key
        FROM site_page_views p LEFT JOIN aliases a ON a.path=lower(rtrim(p.path,'/')) WHERE p.occurred_at>=?::DATE AND p.occurred_at<?::DATE),
        actions AS (SELECT page_id,count(*) FILTER(WHERE name='phone_click') phone,count(*) FILTER(WHERE name='whatsapp_click') whatsapp,count(*) FILTER(WHERE name='email_click') email,
        count(*) FILTER(WHERE name='wishlist_add') wishlistAdds,count(*) FILTER(WHERE name='wishlist_remove') wishlistRemoves FROM site_events WHERE occurred_at>=?::DATE AND occurred_at<?::DATE GROUP BY page_id)
        SELECT listing_key AS "key",CASE WHEN grouping(strftime(occurred_at,'%Y-%m-%d'))=1 THEN NULL ELSE strftime(occurred_at,'%Y-%m-%d') END AS "day",
        count(*) AS views,count(DISTINCT visitor_id||':'||strftime(occurred_at,'%Y-%m-%d')) visitors,count(DISTINCT session_id) sessions,avg(engaged_ms) engagement,avg(max_scroll_percent) AS scroll,
        sum(coalesce(a.phone,0)) phone,sum(coalesce(a.whatsapp,0)) whatsapp,sum(coalesce(a.email,0)) email,sum(coalesce(a.wishlistAdds,0)) wishlistAdds,sum(coalesce(a.wishlistRemoves,0)) wishlistRemoves
        FROM pages LEFT JOIN actions a USING(page_id) WHERE listing_key IS NOT NULL GROUP BY GROUPING SETS((listing_key),(listing_key,strftime(occurred_at,'%Y-%m-%d')))`,
          [f.from, f.to, f.from, f.to],
        );
        const plain = rows
          .getRowObjectsJson()
          .map((r) =>
            Object.fromEntries(
              Object.entries(r).map(([k, v]) => [
                k,
                k === 'key' || k === 'day' ? v : Number(v || 0),
              ]),
            ),
          ) as unknown as TrafficRow[];
        const coverage = await c.runAndReadAll(
          'SELECT min(occurred_at)::VARCHAR AS "first" FROM site_events WHERE kind=\'pageview\'',
        );
        const unmatched = await c.runAndReadAll(
          `SELECT count(*) count FROM site_events e WHERE kind='pageview' AND occurred_at>=?::DATE AND occurred_at<?::DATE AND (SELECT count(DISTINCT a.key) FROM inventory_aliases a WHERE a.path=lower(rtrim(e.path,'/')))<>1 AND (route='/:inventory' OR route LIKE '/projects/%' OR path LIKE '/property/%')`,
          [f.from, f.to],
        );
        const valid = new Set(records.map((r) => r.key));
        return {
          available: true,
          rows: plain.filter((r) => valid.has(r.key)),
          unmatched: Number(unmatched.getRowObjectsJson()[0]?.count || 0),
          first: coverage.getRowObjectsJson()[0]?.first as string | null,
        };
      });
    } catch (error) {
      this.logger.warn(
        'Traffic reporting failed: ' +
          (error instanceof Error ? error.message : 'storage error'),
      );
      return empty;
    }
  }
  private async enquiries(f: InventoryFilters) {
    // Site persistence is the count source. CRM forwarding copies are never added again.
    const rows = await this.db.query<Enquiry[]>(
      `SELECT CASE WHEN project_id IS NOT NULL THEN CONCAT('project:',project_id) ELSE CONCAT('property:',property_id) END \`key\`,DATE_FORMAT(created_at,'%Y-%m-%d') day,
      SUM(COALESCE(analytics_intent,'enquiry')='enquiry') enquiries,SUM(analytics_intent='site_visit') visits,COUNT(DISTINCT analytics_session_id) linkedEnquirySessions,SUM(analytics_session_id IS NOT NULL) linkedSubmissions FROM leads WHERE (project_id IS NOT NULL OR (property_id IS NOT NULL AND property_id<>999)) AND created_at>=? AND created_at<? GROUP BY 1,2`,
      [f.from, f.to],
    );
    return rows.map((r) => ({
      ...r,
      enquiries: Number(r.enquiries),
      visits: Number(r.visits),
      linkedEnquirySessions: Number(r.linkedEnquirySessions),
      linkedSubmissions: Number(r.linkedSubmissions),
    }));
  }
  private async load(f: InventoryFilters) {
    const records = await this.snapshot(f);
    const web = await this.traffic(f, records);
    let enquiries: Enquiry[] = [];
    let enquiryAvailable = true;
    try {
      enquiries = await this.enquiries(f);
    } catch {
      enquiryAvailable = false;
    }
    const totals = new Map<string, TrafficRow>();
    for (const r of records)
      totals.set(r.key, {
        key: r.key,
        day: null,
        views: 0,
        visitors: 0,
        sessions: 0,
        engagement: 0,
        scroll: 0,
        phone: 0,
        whatsapp: 0,
        email: 0,
        wishlistAdds: 0,
        wishlistRemoves: 0,
        enquiries: 0,
        visits: 0,
        linkedEnquirySessions: 0,
      });
    web.rows
      .filter((r) => r.day === null)
      .forEach((r) => totals.set(r.key, { ...totals.get(r.key)!, ...r }));
    for (const r of enquiries) {
      const target = totals.get(r.key);
      if (target) {
        target.enquiries += r.enquiries;
        target.visits += r.visits;
      }
    }
    // Exact denominator-linked sessions, per listing, rather than summing daily distinct counts.
    let submittedSessions: { key: string; session: string }[] = [];
    let linkedAvailable = web.available && enquiryAvailable;
    if (linkedAvailable) {
      try {
        const sessions = await this.db.query<
          { key: string; session: string }[]
        >(
          `SELECT DISTINCT CASE WHEN project_id IS NOT NULL THEN CONCAT('project:',project_id) ELSE CONCAT('property:',property_id) END \`key\`,analytics_session_id session FROM leads WHERE analytics_session_id IS NOT NULL AND COALESCE(analytics_intent,'enquiry')='enquiry' AND created_at>=? AND created_at<?`,
          [f.from, f.to],
        );
        submittedSessions = sessions;
        await this.analytics
          .reporting(async (c) => {
            const result = await c.runAndReadAll(
              `WITH submitted AS (SELECT unnest(from_json(?, '[{"key":"VARCHAR","session":"VARCHAR"}]'),recursive:=true))
          SELECT s.key,count(DISTINCT s.session) count FROM submitted s WHERE EXISTS(SELECT 1 FROM site_events p WHERE p.kind='pageview' AND p.session_id=s.session AND p.occurred_at>=?::DATE AND p.occurred_at<?::DATE AND EXISTS(SELECT 1 FROM inventory_aliases a WHERE a.key=s.key AND a.path=lower(rtrim(p.path,'/')) AND NOT EXISTS(SELECT 1 FROM inventory_aliases other WHERE other.path=a.path AND other.key<>a.key))) GROUP BY s.key`,
              [JSON.stringify(sessions), f.from, f.to],
            );
            for (const row of result.getRowObjectsJson()) {
              const target = totals.get(
                typeof row.key === 'string' ? row.key : '',
              );
              if (target) target.linkedEnquirySessions = Number(row.count);
            }
          })
          .catch(() => {
            linkedAvailable = false;
          });
      } catch {
        linkedAvailable = false;
      }
    }
    const now = f.asOf ? Date.parse(f.asOf) + 86400000 : Date.now();
    const index = issueIndex(
      records,
      now,
      web.available ? totals : new Map<string, TrafficRow>(),
    );
    return {
      records,
      web,
      enquiries,
      enquiryAvailable,
      linkedAvailable,
      submittedSessions,
      totals,
      index,
      now,
    };
  }
  async report(raw: Record<string, unknown>) {
    const f = validateInventoryFilters(raw);
    const key = JSON.stringify(f);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.at < 60000) return cached.data;
    const loaded = await this.load(f);
    const result = sectionReport(
      loaded.records,
      f,
      loaded.index,
      loaded.totals,
      loaded.web.rows.filter((r) => r.day !== null),
      loaded.now,
      loaded.enquiries,
    );
    if (!loaded.web.available) {
      result.metrics = result.metrics.map((m) =>
        [
          'views',
          'rate',
          'visitor_days',
          'sessions',
          'engagement',
          'scroll',
        ].includes(m.key)
          ? { ...m, value: null }
          : m,
      );
      if (f.section === 'demand')
        result.charts = result.charts.filter((c) =>
          ['saves', 'accepted'].includes(c.key),
        );
    }
    if (!loaded.enquiryAvailable)
      result.metrics = result.metrics.map((m) =>
        ['enquiries', 'visits', 'rate'].includes(m.key)
          ? { ...m, value: null }
          : m,
      );
    if (!loaded.linkedAvailable)
      result.metrics = result.metrics.map((m) =>
        m.key === 'rate' ? { ...m, value: null } : m,
      );
    if (!loaded.enquiryAvailable)
      result.charts = result.charts.filter((c) => c.key !== 'accepted');
    const selectedKeys = new Set(result.records.map((r) => r.key));
    const acceptedRows = loaded.enquiries.filter((r) =>
      selectedKeys.has(r.key),
    );
    if (
      this.historyAvailable &&
      (f.section || 'overview') === 'overview' &&
      !Object.keys(f).some(
        (k) => !['section', 'from', 'to', 'kind'].includes(k),
      )
    ) {
      const rows: Record<string, unknown>[] = await this.analytics
        .reporting(async (c) =>
          (
            await c.runAndReadAll(
              `SELECT day::VARCHAR AS "label",json_extract_string(record,'$.kind') series,count(*)::INTEGER value FROM inventory_snapshots WHERE day>=?::DATE AND day<?::DATE AND (?='all' OR json_extract_string(record,'$.kind')=?) GROUP BY day,series ORDER BY day`,
              [f.from, f.to, f.kind || 'all', f.kind || 'all'],
            )
          ).getRowObjectsJson(),
        )
        .catch(() => []);
      result.charts.push({
        key: 'stock_history',
        title: 'Recorded inventory snapshots',
        type: 'area',
        rows: rows.map((r) => ({
          label: typeof r.label === 'string' ? r.label : '',
          series: typeof r.series === 'string' ? r.series : '',
          value: Number(r.value),
          match: {
            asOf: typeof r.label === 'string' ? r.label : '',
            kind: typeof r.series === 'string' ? r.series : '',
          },
        })),
        note: 'Daily captured inventory from the rollout baseline. Use As of with filters for a historical stock report.',
      });
    }
    if (f.section === 'demand' && loaded.web.available) {
      try {
        const observations = await this.analytics.reporting(async (c) =>
          (
            await c.runAndReadAll(
              `WITH aliases AS(SELECT path,first(key) listing_key FROM inventory_aliases GROUP BY path HAVING count(DISTINCT key)=1),
          submitted AS(SELECT unnest(from_json(?, '[{"key":"VARCHAR","session":"VARCHAR"}]'),recursive:=true)),
          pages AS(SELECT p.*,a.listing_key FROM site_page_views p JOIN aliases a ON a.path=lower(rtrim(p.path,'/')) WHERE p.occurred_at>=?::DATE AND p.occurred_at<?::DATE AND a.listing_key IN(SELECT unnest(from_json(?, '["VARCHAR"]'))))
          SELECT CASE WHEN grouping(strftime(occurred_at,'%Y-%m-%d'))=1 THEN NULL ELSE strftime(occurred_at,'%Y-%m-%d') END AS "day",count(DISTINCT session_id) sessions,count(DISTINCT visitor_id||':'||strftime(occurred_at,'%Y-%m-%d')) visitors,count(DISTINCT session_id) FILTER(WHERE EXISTS(SELECT 1 FROM submitted s WHERE s.key=pages.listing_key AND s.session=pages.session_id)) converted FROM pages GROUP BY GROUPING SETS((),(strftime(occurred_at,'%Y-%m-%d')))`,
              [
                JSON.stringify(loaded.submittedSessions),
                f.from,
                f.to,
                JSON.stringify([...selectedKeys]),
              ],
            )
          ).getRowObjectsJson(),
        );
        const total = observations.find((r) => r.day === null);
        if (total)
          result.metrics = result.metrics.map((m) =>
            m.key === 'visitor_days'
              ? { ...m, label: 'Visitor-days', value: Number(total.visitors) }
              : m.key === 'sessions'
                ? { ...m, label: 'Sessions', value: Number(total.sessions) }
                : m.key === 'rate'
                  ? {
                      ...m,
                      value:
                        loaded.linkedAvailable && Number(total.sessions) > 0
                          ? (Number(total.converted) / Number(total.sessions)) *
                            100
                          : null,
                    }
                  : m,
          );
        result.charts.push({
          key: 'enquiry_rate',
          title: 'Attributed enquiry session rate',
          type: 'line',
          unit: '%',
          rows: observations
            .filter((r) => r.day !== null)
            .map((r) => ({
              label: typeof r.day === 'string' ? r.day : '',
              value:
                loaded.linkedAvailable && Number(r.sessions) > 0
                  ? (Number(r.converted) / Number(r.sessions)) * 100
                  : null,
              numerator: loaded.linkedAvailable ? Number(r.converted) : null,
              denominator: Number(r.sessions),
              match: {
                from: typeof r.day === 'string' ? r.day : f.from,
                to:
                  typeof r.day === 'string'
                    ? new Date(Date.parse(r.day) + 86400000)
                        .toISOString()
                        .slice(0, 10)
                    : f.to,
                activity: 'views',
              },
            })),
          note: 'Distinct listing-view sessions containing an attributable accepted enquiry, with numerator and denominator.',
        });
      } catch {
        result.metrics = result.metrics.map((m) =>
          ['visitor_days', 'sessions', 'rate'].includes(m.key)
            ? { ...m, value: null }
            : m,
        );
      }
    }
    const recordRows = result.records.map((r) =>
      this.row(
        r,
        loaded.index,
        loaded.totals,
        loaded.web.available,
        loaded.enquiryAvailable,
      ),
    );
    const data = {
      listingKeys: result.records.map((r) => r.key),
      version: 2,
      filters: f,
      timezone: 'UTC',
      snapshotAt: await this.snapshotTime(f),
      sources: {
        inventory: this.syncError ? 'stale' : 'available',
        traffic: loaded.web.available ? 'available' : 'unavailable',
        enquiries: loaded.enquiryAvailable ? 'available' : 'unavailable',
        history: this.historyAvailable ? 'available' : 'unavailable',
      },
      coverage: {
        trafficFrom: loaded.web.first,
        unmatchedViews: loaded.web.unmatched,
        historyMessage: this.historyError,
        historyFrom: await this.historyStart(),
        acceptedSubmissions: loaded.enquiryAvailable
          ? acceptedRows.reduce((s, r) => s + r.enquiries + r.visits, 0)
          : null,
        linkedSubmissions: loaded.enquiryAvailable
          ? acceptedRows.reduce((s, r) => s + r.linkedSubmissions, 0)
          : null,
        activityFrom: f.from,
        activityTo: f.to,
      },
      metrics: result.metrics,
      charts: result.charts,
      issues: result.issueCounts,
      selectionRequired: result.selectionRequired,
      records: { total: recordRows.length, items: recordRows.slice(0, 20) },
      freshnessMessage: this.syncError,
    };
    if (this.cache.size >= 128) {
      const oldest: unknown = this.cache.keys().next().value;
      if (typeof oldest === 'string') this.cache.delete(oldest);
    }
    this.cache.set(key, { at: Date.now(), data });
    return data;
  }
  private async snapshotTime(f: InventoryFilters) {
    if (!f.asOf) return this.syncedAt;
    return this.analytics.reporting(async (c) => {
      const rows = await c.runAndReadAll(
        'SELECT captured_at::VARCHAR captured FROM inventory_snapshot_runs WHERE day=?::DATE',
        [f.asOf!],
      );
      const at = rows.getRowObjectsJson()[0]?.captured;
      return typeof at === 'string' ? at.replace(' ', 'T') + 'Z' : null;
    });
  }
  private async historyStart() {
    if (!this.historyAvailable) return null;
    return this.analytics
      .reporting(async (c) => {
        const rows = await c.runAndReadAll(
          "SELECT value FROM inventory_meta WHERE key='baseline'",
        );
        return rows.getRowObjectsJson()[0]?.value || null;
      })
      .catch(() => null);
  }
  private row(
    r: InventoryRecord,
    index: Map<string, string[]>,
    totals: Map<string, TrafficRow>,
    trafficAvailable = true,
    enquiryAvailable = true,
  ) {
    return {
      ...r,
      issues: index.get(r.key) || [],
      traffic: trafficAvailable
        ? {
            ...totals.get(r.key),
            enquiries: enquiryAvailable
              ? (totals.get(r.key)?.enquiries ?? 0)
              : null,
            visits: enquiryAvailable ? (totals.get(r.key)?.visits ?? 0) : null,
          }
        : {
            ...totals.get(r.key),
            enquiries: enquiryAvailable
              ? (totals.get(r.key)?.enquiries ?? 0)
              : null,
            visits: enquiryAvailable ? (totals.get(r.key)?.visits ?? 0) : null,
            views: null,
            visitors: null,
            sessions: null,
            engagement: null,
            scroll: null,
            phone: null,
            whatsapp: null,
            email: null,
            wishlistAdds: null,
            wishlistRemoves: null,
          },
      href: r.kind === 'property' ? '/properties/' + r.id : '/projects/' + r.id,
    };
  }
  async recordsPage(raw: Record<string, unknown>) {
    const f = validateInventoryFilters(raw);
    const loaded = await this.load(f);
    const selected = filterInventory(
      loaded.records,
      f,
      loaded.index,
      loaded.totals,
    );
    const page = Number(f.page || 1),
      limit = Math.min(100, Number(f.limit || 20));
    const configurations =
      f.configurationStatus ||
      f.configurationType ||
      f.configurationMode ||
      f.configurationBedrooms
        ? selected.flatMap((r) =>
            r.configurations
              .filter((c) => configurationMatches(c, f))
              .map((c) => ({
                configuration: c,
                listing: this.row(
                  r,
                  loaded.index,
                  loaded.totals,
                  loaded.web.available,
                ),
              })),
          )
        : null;
    return {
      filters: f,
      total: configurations ? configurations.length : selected.length,
      page,
      limit,
      ...(configurations
        ? {
            configurations: configurations.slice(
              (page - 1) * limit,
              page * limit,
            ),
          }
        : {}),
      items: selected
        .slice((page - 1) * limit, page * limit)
        .map((r) =>
          this.row(
            r,
            loaded.index,
            loaded.totals,
            loaded.web.available,
            loaded.enquiryAvailable,
          ),
        ),
    };
  }
  async options(raw: Record<string, unknown>) {
    const f = validateInventoryFilters(raw);
    const records = await this.snapshot(f);
    const values = (read: (r: InventoryRecord) => string[]) =>
      [...new Set(records.flatMap(read).filter(Boolean))].sort();
    return {
      city: values((r) => (r.city ? [r.city] : [])),
      locality: values((r) =>
        !f.city || r.city === f.city ? r.localities : [],
      ),
      type: values((r) => [r.type]),
      status: values((r) => [r.status]),
      approval: values((r) => (r.approval ? [r.approval] : [])),
      builder: values((r) =>
        r.builderId
          ? ['id:' + r.builderId]
          : r.builder
            ? ['name:' + r.builder]
            : [],
      ),
      project: records
        .filter((r) => r.kind === 'project')
        .map((r) => ({ value: String(r.id), label: r.title })),
      uploader: values((r) => (r.uploaderId ? [String(r.uploaderId)] : [])),
      areaBasis: values((r) => (r.areaBasis ? [r.areaBasis] : [])),
    };
  }
  async detail(key: string, raw: Record<string, unknown>) {
    if (!/^(property|project):[1-9]\d*$/.test(key))
      throw new BadRequestException('Invalid listing');
    const f = validateInventoryFilters({ ...raw, key });
    const loaded = await this.load(f);
    const r = filterInventory(
      loaded.records,
      f,
      loaded.index,
      loaded.totals,
    ).find((r) => r.key === key);
    if (!r)
      throw new BadRequestException('Listing unavailable in this snapshot');
    const history = await this.history(key).catch(() => ({
      events: [],
      snapshots: [],
      coverageFrom: null,
    }));
    return {
      listingKeys: [r.key],
      record: this.row(
        r,
        loaded.index,
        loaded.totals,
        loaded.web.available,
        loaded.enquiryAvailable,
      ),
      history,
      daily: loaded.web.rows.filter((r) => r.key === key && r.day),
      enquiries: loaded.enquiries.filter((r) => r.key === key),
    };
  }
  async history(key: string) {
    return this.analytics.reporting(async (c) => {
      const [kind, id] = key.split(':');
      const events = await c.runAndReadAll(
        'SELECT id,subject,subject_id,action,before_json,after_json,occurred_at::VARCHAR AS "at" FROM inventory_events WHERE kind=? AND listing_id=? ORDER BY occurred_at DESC LIMIT 200',
        [kind, Number(id)],
      );
      const snapshots = await c.runAndReadAll(
        'SELECT day::VARCHAR AS "day",captured_at::VARCHAR AS "capturedAt",record FROM inventory_snapshots WHERE key=? ORDER BY day',
        [key],
      );
      const meta = await c.runAndReadAll(
        "SELECT value FROM inventory_meta WHERE key='baseline'",
      );
      return {
        events: events.getRowObjectsJson(),
        snapshots: snapshots.getRowObjectsJson().map((r) => ({
          day: r.day,
          capturedAt: r.capturedAt,
          record: decode<InventoryRecord>(r.record),
        })),
        coverageFrom: meta.getRowObjectsJson()[0]?.value || null,
      };
    });
  }
  async compare(keys: string[], raw: Record<string, unknown>) {
    if (
      keys.length < 2 ||
      keys.length > 4 ||
      new Set(keys).size !== keys.length ||
      new Set(keys.map((k) => k.split(':')[0])).size !== 1
    )
      throw new BadRequestException(
        'Compare two to four listings of the same kind',
      );
    return {
      listings: await Promise.all(keys.map((k) => this.detail(k, raw))),
    };
  }
  async exportRecords(raw: Record<string, unknown>) {
    const f = validateInventoryFilters(raw);
    const loaded = await this.load(f);
    return {
      filters: f,
      snapshotAt: await this.snapshotTime(f),
      records: filterInventory(
        loaded.records,
        f,
        loaded.index,
        loaded.totals,
      ).flatMap<Record<string, unknown>>((r) =>
        f.configurationStatus ||
        f.configurationType ||
        f.configurationMode ||
        f.configurationBedrooms
          ? r.configurations
              .filter((c) => configurationMatches(c, f))
              .map((c) => ({
                key: r.key,
                title: r.title,
                kind: r.kind,
                configurationId: c.id,
                configurationCode: c.code,
                configurationStatus: c.status,
                askingPrice: c.price,
                monthlyRent: c.rent,
              }))
          : [
              {
                key: r.key,
                title: r.title,
                kind: r.kind,
                city: r.city,
                status: r.status,
                approval: r.approval,
                visible: r.visible,
                askingPrice: r.price,
                monthlyRent: r.rent,
                issues: loaded.index.get(r.key) || [],
                views: loaded.web.available
                  ? loaded.totals.get(r.key)?.views || 0
                  : null,
                enquiries: loaded.enquiryAvailable
                  ? loaded.totals.get(r.key)?.enquiries || 0
                  : null,
              },
            ],
      ),
      report: await this.report(raw),
    };
  }
}
