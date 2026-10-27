import { MigrationInterface, QueryRunner } from 'typeorm';
import { normalizeSeoSlug } from '../../modules/properties/utils/property-slug.util';

type SlugRow = { id: number; slug: string };
export type SlugRepair = { id: number; from: string; to: string };

const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
// seo_redirects.source_path is ASCII; non-ASCII legacy slugs are renamed without a redirect.
const ASCII = /^[\x20-\x7e]+$/;

/** Renames only unsafe slugs, keeping the id code, and never onto a slug already in use. */
export function planSlugRepairs(rows: SlugRow[], taken: Iterable<string>): SlugRepair[] {
  const used = new Set(taken);
  const repairs: SlugRepair[] = [];
  for (const row of rows) {
    if (!row.slug || SAFE_SLUG.test(row.slug)) continue;
    const to = normalizeSeoSlug(row.slug);
    if (!to || used.has(to)) continue;
    used.add(to);
    repairs.push({ id: row.id, from: row.slug, to });
  }
  return repairs;
}

/**
 * Property slugs containing "&", "'" or "." broke URLs: `/p&k-…-fl028` looped on
 * a 308 to itself and canonicals rendered `daksha&#x27;s`. Rename them to the
 * slug rules new listings now use and keep every old URL working with a 301.
 */
export class SanitizePropertySlugs1785500000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const rows: SlugRow[] = await q.query(
      "SELECT id,slug FROM properties WHERE slug IS NOT NULL AND slug<>'' AND slug NOT REGEXP '^[a-z0-9]+(-[a-z0-9]+)*$'",
    );
    if (!rows.length) return;
    const taken: { slug: string }[] = await q.query(
      "SELECT slug FROM properties WHERE slug IS NOT NULL AND slug<>''",
    );
    const paths: { public_path: string }[] = await q.query(
      'SELECT public_path FROM seo_configs WHERE public_path IS NOT NULL',
    );
    const repairs = planSlugRepairs(rows, [
      ...taken.map((r) => r.slug),
      ...paths.map((r) => r.public_path.replace(/^\//, '')),
    ]);
    for (const { id, from, to } of repairs) {
      const oldPath = '/' + from;
      const newPath = '/' + to;
      await q.query('UPDATE properties SET slug=? WHERE id=?', [to, id]);
      await q.query(
        'UPDATE seo_configs SET public_path=?,revision=revision+1 WHERE property_id=? AND public_path=?',
        [newPath, id, oldPath],
      );
      if (!ASCII.test(oldPath)) continue;
      // Point existing redirects at the new URL directly instead of chaining.
      await q.query(
        'UPDATE seo_redirects SET destination_path=? WHERE destination_path=? AND source_path<>?',
        [newPath, oldPath, newPath],
      );
      await q.query(
        `INSERT INTO seo_redirects (source_path,destination_path,reason,is_active)
         VALUES (?,?,'slug-sanitise',1)
         ON DUPLICATE KEY UPDATE destination_path=VALUES(destination_path),is_active=1`,
        [oldPath, newPath],
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    const rows: { source_path: string; destination_path: string }[] = await q.query(
      "SELECT source_path,destination_path FROM seo_redirects WHERE reason='slug-sanitise'",
    );
    for (const row of rows) {
      const from = row.source_path.replace(/^\//, '');
      const to = row.destination_path.replace(/^\//, '');
      await q.query('UPDATE properties SET slug=? WHERE slug=?', [from, to]);
      await q.query('UPDATE seo_configs SET public_path=? WHERE public_path=?', [
        row.source_path,
        row.destination_path,
      ]);
      await q.query(
        "UPDATE seo_redirects SET destination_path=? WHERE destination_path=? AND reason<>'slug-sanitise' AND source_path<>?",
        [row.source_path, row.destination_path, row.source_path],
      );
    }
    await q.query("DELETE FROM seo_redirects WHERE reason='slug-sanitise'");
  }
}
