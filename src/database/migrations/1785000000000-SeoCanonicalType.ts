import { MigrationInterface, QueryRunner } from 'typeorm';
export class SeoCanonicalType1785000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasColumn('seo_configs', 'canonical_type'))) {
      await q.query(
        "ALTER TABLE seo_configs ADD canonical_type ENUM('self','parent','custom') NOT NULL DEFAULT 'self'",
      );
      // Preserve intentional existing manual canonicals.
      await q.query(
        "UPDATE seo_configs SET canonical_type='custom' WHERE canonical_url IS NOT NULL AND canonical_url<>''",
      );
    }
  }
  async down(q: QueryRunner): Promise<void> {
    if (await q.hasColumn('seo_configs', 'canonical_type'))
      await q.query('ALTER TABLE seo_configs DROP COLUMN canonical_type');
  }
}
