import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { existsSync, renameSync, rmSync } from 'node:fs';

/** Deleted row versions DuckDB is still storing before a rewrite is worth it. */
export const DEAD_ROWS_TO_COMPACT = 250_000;

type Logger = { log(message: string): void; warn(message: string): void };
type TableRows = { table: string; stored: number; live: number };

const quote = (name: string) => '"' + name.replace(/"/g, '""') + '"';
const literal = (value: string) => "'" + value.replace(/'/g, "''") + "'";

/** Removes a leftover file; cleanup never hides the original error. */
function discard(file: string) {
  try {
    rmSync(file, { force: true });
  } catch {
    /* left for the next start */
  }
}

async function rows<T>(conn: DuckDBConnection, sql: string): Promise<T[]> {
  return (await conn.runAndReadAll(sql)).getRowObjectsJson() as T[];
}

/** Rows each table stores (deleted versions included) against the rows it really holds. */
export async function tableRows(
  conn: DuckDBConnection,
  database: string,
): Promise<TableRows[]> {
  const tables = await rows<{ table_name: string; estimated_size: string }>(
    conn,
    `SELECT table_name, estimated_size FROM duckdb_tables() WHERE database_name=${literal(database)} AND schema_name='main' ORDER BY table_name`,
  );
  const out: TableRows[] = [];
  for (const t of tables) {
    const [{ n }] = await rows<{ n: string }>(
      conn,
      `SELECT count(*) AS n FROM ${quote(database)}.main.${quote(t.table_name)}`,
    );
    out.push({
      table: t.table_name,
      stored: Number(t.estimated_size),
      live: Number(n),
    });
  }
  return out;
}

/**
 * Opens the analytics file, and when it is mostly deleted row versions
 * (DuckDB keeps them after DELETE), copies the live data into a fresh file,
 * checks every table's row count, and swaps it in. The old file is kept as
 * `<file>.precompact` until the next compaction. Any failure leaves the
 * original file in place and open.
 */
export async function openCompacted(
  path: string,
  open: () => Promise<DuckDBInstance>,
  logger: Logger,
  threshold = DEAD_ROWS_TO_COMPACT,
): Promise<DuckDBInstance> {
  let instance = await open();
  let closed = false;
  const target = path + '.compact';
  let conn: DuckDBConnection | null = await instance.connect();
  try {
    const [{ db }] = await rows<{ db: string }>(
      conn,
      'SELECT current_database() AS db',
    );
    const before = await tableRows(conn, db);
    const dead = before.reduce(
      (sum, t) => sum + Math.max(0, t.stored - t.live),
      0,
    );
    if (dead < threshold) return instance;

    logger.log(`Compacting analytics storage: ${dead} deleted row versions`);
    rmSync(target, { force: true });
    rmSync(target + '.wal', { force: true });
    await conn.run('CHECKPOINT');
    await conn.run(`ATTACH ${literal(target)} AS compact_target`);
    await conn.run(`COPY FROM DATABASE ${quote(db)} TO compact_target`);
    const after = await tableRows(conn, 'compact_target');
    const mismatch = before.find(
      (t) => after.find((a) => a.table === t.table)?.live !== t.live,
    );
    if (mismatch || after.length !== before.length)
      throw new Error(
        `row counts differ after copy (${mismatch?.table ?? 'tables'})`,
      );
    await conn.run('DETACH compact_target');
    conn.closeSync();
    conn = null;
    instance.closeSync();
    closed = true;

    renameSync(path, path + '.precompact');
    if (existsSync(path + '.wal'))
      renameSync(path + '.wal', path + '.precompact.wal');
    renameSync(target, path);
    instance = await open();
    logger.log(
      `Analytics storage compacted: ${before.map((t) => `${t.table} ${t.live}`).join(', ')}`,
    );
    return instance;
  } catch (error) {
    logger.warn(
      `Analytics compaction skipped: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    try {
      await conn?.run('DETACH DATABASE IF EXISTS compact_target');
    } catch {
      /* already detached */
    }
    conn?.closeSync();
    conn = null;
    discard(target);
    discard(target + '.wal');
    // The original may have been closed or renamed mid-swap: put it back and reopen.
    if (!existsSync(path) && existsSync(path + '.precompact'))
      renameSync(path + '.precompact', path);
    return closed ? open() : instance;
  } finally {
    conn?.closeSync();
  }
}
