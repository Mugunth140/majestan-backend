import { DuckDBInstance } from '@duckdb/node-api';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ANALYTICS_SCHEMA,
  INVENTORY_ANALYTICS_SCHEMA,
} from './analytics-schema';
import { openCompacted, tableRows } from './analytics-compaction';

jest.setTimeout(60_000);

describe('analytics storage compaction', () => {
  let dir: string, path: string;
  const logger = { log: jest.fn(), warn: jest.fn() };
  const open = () => DuckDBInstance.create(path);

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'analytics-compaction-'));
    path = join(dir, 'site.duckdb');
    jest.clearAllMocks();
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  /** The old refresh: replace every inventory row by DELETE + INSERT, many times. */
  async function bloat(rounds: number) {
    const instance = await open();
    const c = await instance.connect();
    await c.run(ANALYTICS_SCHEMA);
    await c.run(INVENTORY_ANALYTICS_SCHEMA);
    await c.run("INSERT INTO inventory_meta VALUES ('baseline','2026-11-01')");
    for (let i = 0; i < rounds; i++) {
      await c.run('DELETE FROM inventory_current');
      await c.run(
        "INSERT INTO inventory_current SELECT 'property:'||i, json_object('i',i,'pad',repeat('x',400)), now() FROM range(2000) t(i)",
      );
      await c.run('CHECKPOINT');
    }
    c.closeSync();
    instance.closeSync();
  }

  it('rewrites a file of deleted row versions and keeps every live row', async () => {
    await bloat(25);
    const instance = await openCompacted(path, open, logger, 10_000);
    const c = await instance.connect();
    const rows = await tableRows(c, 'site');
    const current = rows.find((t) => t.table === 'inventory_current')!;
    expect(current.live).toBe(2000);
    // Only live rows are stored after the rewrite.
    expect(current.stored).toBeLessThan(4000);
    expect(logger.log).toHaveBeenCalledWith(
      expect.stringMatching(/deleted row versions/),
    );
    expect(rows.find((t) => t.table === 'inventory_meta')?.live).toBe(1);
    // Primary keys survive the copy.
    await expect(
      c.run("INSERT INTO inventory_meta VALUES ('baseline','again')"),
    ).rejects.toThrow(/constraint/i);
    // The schema still applies on top of the copy (views, indexes).
    await c.run(ANALYTICS_SCHEMA);
    c.closeSync();
    instance.closeSync();
    expect(existsSync(path + '.precompact')).toBe(true);
    expect(existsSync(path + '.compact')).toBe(false);
  });

  it('leaves a file with little dead data alone', async () => {
    await bloat(1);
    const instance = await openCompacted(path, open, logger);
    instance.closeSync();
    expect(existsSync(path + '.precompact')).toBe(false);
    expect(logger.log).not.toHaveBeenCalled();
  });

  it('keeps the original file open when the copy fails', async () => {
    await bloat(5);
    // A directory where the copy should go makes ATTACH fail.
    const blocker = path + '.compact';
    mkdirSync(blocker);
    writeFileSync(join(blocker, 'keep'), 'x');
    const instance = await openCompacted(path, open, logger, 1);
    const c = await instance.connect();
    const [{ n }] = (
      await c.runAndReadAll('SELECT count(*)::INTEGER n FROM inventory_current')
    ).getRowObjectsJson() as { n: number }[];
    c.closeSync();
    instance.closeSync();
    expect(n).toBe(2000);
    expect(logger.warn).toHaveBeenCalled();
    expect(existsSync(path + '.precompact')).toBe(false);
  });
});
