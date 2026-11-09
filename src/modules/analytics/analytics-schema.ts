// Owned by the site process, NEVER attach crm.duckdb here. These migrations are
// DuckDB DDL, separate from the MySQL/TypeORM migration channels.
export const ANALYTICS_SCHEMA = `
CREATE TABLE IF NOT EXISTS analytics_schema (version INTEGER PRIMARY KEY, applied_at TIMESTAMP DEFAULT current_timestamp);
CREATE TABLE IF NOT EXISTS site_events (
  id VARCHAR PRIMARY KEY, session_id VARCHAR NOT NULL, page_id VARCHAR NOT NULL,
  visitor_id VARCHAR NOT NULL, kind VARCHAR NOT NULL, name VARCHAR NOT NULL,
  occurred_at TIMESTAMP NOT NULL, received_at TIMESTAMP DEFAULT current_timestamp,
  hostname VARCHAR, path VARCHAR, route VARCHAR, referrer VARCHAR,
  utm_source VARCHAR, utm_medium VARCHAR, utm_campaign VARCHAR,
  browser VARCHAR, os VARCHAR, device VARCHAR, country VARCHAR,
  language VARCHAR, timezone VARCHAR, viewport_width INTEGER, viewport_height INTEGER,
  screen_width INTEGER, screen_height INTEGER, duration_ms DOUBLE, scroll_percent DOUBLE,
  value DOUBLE, rating VARCHAR, metric_id VARCHAR, target_host VARCHAR, entity_id BIGINT, status_code INTEGER
);
ALTER TABLE site_events ADD COLUMN IF NOT EXISTS entity_kind VARCHAR;
CREATE INDEX IF NOT EXISTS site_events_time ON site_events(occurred_at);
CREATE OR REPLACE VIEW site_page_views AS
  SELECT p.*, coalesce(g.duration_ms,0) AS engaged_ms, coalesce(g.scroll_percent,0) AS max_scroll_percent
  FROM site_events p LEFT JOIN (
    SELECT page_id, max(duration_ms) duration_ms, max(scroll_percent) scroll_percent
    FROM site_events WHERE kind='engagement' GROUP BY page_id
  ) g USING(page_id) WHERE p.kind='pageview';
CREATE OR REPLACE VIEW site_sessions AS
  SELECT session_id, min(occurred_at) started_at, max(occurred_at) last_seen_at,
    arg_min(visitor_id,occurred_at) visitor_id,
    arg_min(path,occurred_at) entry_path, arg_max(path,occurred_at) exit_path,
    first(referrer ORDER BY occurred_at) referrer, first(utm_source ORDER BY occurred_at) utm_source,
    first(utm_medium ORDER BY occurred_at) utm_medium, first(utm_campaign ORDER BY occurred_at) utm_campaign,
    arg_min(country,occurred_at) country, arg_min(device,occurred_at) device,
    count(*) pageviews, sum(engaged_ms) engaged_ms, max(max_scroll_percent) max_scroll_percent
  FROM site_page_views GROUP BY session_id;
CREATE OR REPLACE VIEW site_vitals AS
  SELECT page_id, name, metric_id, arg_max(path,occurred_at) path,
    arg_max(device,occurred_at) device, arg_max(country,occurred_at) country,
    arg_max(value,occurred_at) AS "value", arg_max(rating,occurred_at) rating, max(occurred_at) occurred_at
  FROM site_events WHERE kind='web_vital' GROUP BY page_id,name,metric_id;
CREATE OR REPLACE VIEW site_daily AS
  SELECT CAST(occurred_at AS DATE) AS "day", count(*) pageviews, count(DISTINCT visitor_id) visitors,
    count(DISTINCT session_id) sessions, sum(engaged_ms) engaged_ms
  FROM site_page_views GROUP BY 1;
INSERT INTO analytics_schema(version) VALUES (1) ON CONFLICT DO NOTHING;
`;

export const INVENTORY_ANALYTICS_SCHEMA = `
CREATE TABLE IF NOT EXISTS inventory_current (key VARCHAR PRIMARY KEY,record JSON NOT NULL,synced_at TIMESTAMP NOT NULL);
CREATE TABLE IF NOT EXISTS inventory_snapshots (day DATE,key VARCHAR,record JSON NOT NULL,captured_at TIMESTAMP NOT NULL,PRIMARY KEY(day,key));
CREATE TABLE IF NOT EXISTS inventory_snapshot_runs(day DATE PRIMARY KEY,captured_at TIMESTAMP NOT NULL);
CREATE TABLE IF NOT EXISTS inventory_events (id BIGINT PRIMARY KEY,kind VARCHAR,listing_id BIGINT,subject VARCHAR,subject_id BIGINT,action VARCHAR,before_json JSON,after_json JSON,occurred_at TIMESTAMP);
CREATE TABLE IF NOT EXISTS inventory_aliases (path VARCHAR,key VARCHAR,first_seen TIMESTAMP,last_seen TIMESTAMP,PRIMARY KEY(path,key));
CREATE TABLE IF NOT EXISTS inventory_meta(key VARCHAR PRIMARY KEY,value VARCHAR);
`;
