import { MigrationInterface, QueryRunner } from 'typeorm';
import { defaultSections, sections } from '../../modules/seo-engine/seo-fields';

export class SeoFieldProvisioning1784800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasColumn('seo_listing_pages', 'show_live_market_snapshot')))
      await q.query(
        'ALTER TABLE seo_listing_pages ADD show_live_market_snapshot BOOLEAN NOT NULL DEFAULT TRUE',
      );
    const checks = await q.query(
      "SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='seo_listing_pages' AND CONSTRAINT_TYPE='CHECK' AND CONSTRAINT_NAME='chk_listing_inventory'",
    );
    if (checks.length)
      await q.query(
        'ALTER TABLE seo_listing_pages DROP CHECK chk_listing_inventory',
      );
    await q.query(
      "ALTER TABLE seo_listing_pages ADD CONSTRAINT chk_listing_inventory CHECK (inventory_kind IN ('property','project'))",
    );
    const rows = await q.query(
      "SELECT id,scope,section_seo,settings,revision FROM seo_configs WHERE scope IN ('project','property','template')",
    );
    const parse = (v: any) => (typeof v === 'string' ? JSON.parse(v) : v || {});
    for (const row of rows) {
      const settings = parse(row.settings),
        scope = row.scope === 'template' ? settings.scope : row.scope;
      let next = sections(parse(row.section_seo));
      if (row.scope === 'template' && ['project', 'property'].includes(scope)) {
        const defaults = defaultSections(scope);
        for (const [key, value] of Object.entries(defaults))
          next[key] =
            Number(row.revision) === 0
              ? { ...next[key], ...value }
              : { ...value, ...next[key] };
      }
      if (row.scope === 'template' && !settings.image_alt_template)
        settings.image_alt_template =
          '{Property_Name} - {BHK} {Property_Type} in {Sub_Locality}, {City} - View {Index}';
      await q.query(
        'UPDATE seo_configs SET section_seo=?,settings=?,revision=revision+1 WHERE id=?',
        [JSON.stringify(next), JSON.stringify(settings), row.id],
      );
    }
    await q.query(`INSERT IGNORE INTO seo_configs(config_key,scope,public_path,meta_title,meta_description,h1,robots_index,robots_follow,settings)
    VALUES('page:services/nri-services','page','/services/nri-services','NRI Property Services | Majestan Realty','Explore Majestan Realty property investment and management services for non-resident Indians.','NRI Property Services',1,1,JSON_OBJECT())`);
  }
  async down(q: QueryRunner): Promise<void> {
    if (await q.hasColumn('seo_listing_pages', 'show_live_market_snapshot'))
      await q.query(
        'ALTER TABLE seo_listing_pages DROP COLUMN show_live_market_snapshot',
      );
    // Existing editorial content and canonical section keys are retained.
  }
}
