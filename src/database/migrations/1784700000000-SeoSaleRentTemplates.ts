import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeoSaleRentTemplates1784700000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Temporarily free the buy keys before deduplication. Reconciliation rows
    // keep a stable winner and let us redirect valid former rule paths.
    await q.query(
      `UPDATE seo_listing_pages SET filter_key=CONCAT(filter_key,':migration:',id) WHERE transaction_intent IN ('new','resale')`,
    );
    await q.query(`CREATE TEMPORARY TABLE seo_listing_reconcile AS
      SELECT id,seo_config_id,
        ROW_NUMBER() OVER (PARTITION BY inventory_kind,COALESCE(property_type,''),COALESCE(project_type,''),city_id,
          COALESCE(sublocation_id,0),COALESCE(bedrooms,0)
          ORDER BY CASE WHEN transaction_intent='buy' THEN 0 ELSE 1 END,id) AS duplicate_rank,
        FIRST_VALUE(seo_config_id) OVER (PARTITION BY inventory_kind,COALESCE(property_type,''),COALESCE(project_type,''),city_id,
          COALESCE(sublocation_id,0),COALESCE(bedrooms,0)
          ORDER BY CASE WHEN transaction_intent='buy' THEN 0 ELSE 1 END,id) AS winner_config_id
      FROM seo_listing_pages WHERE transaction_intent IN ('buy','new','resale')`);
    await q.query(`INSERT IGNORE INTO seo_redirects(source_path,destination_path,status_code,reason)
      SELECT DISTINCT loser.public_path,winner.public_path,301,'migration'
      FROM seo_listing_reconcile r
      JOIN seo_configs loser ON loser.id=r.seo_config_id
      JOIN seo_configs winner ON winner.id=r.winner_config_id
      WHERE r.duplicate_rank>1 AND loser.public_path IS NOT NULL AND winner.public_path IS NOT NULL
        AND loser.public_path<>winner.public_path
        AND LEFT(loser.public_path,1)='/' AND LEFT(winner.public_path,1)='/'
        AND LEFT(loser.public_path,2)<>'//' AND LEFT(winner.public_path,2)<>'//'
        AND LOCATE(' ',loser.public_path)=0 AND LOCATE(' ',winner.public_path)=0
        AND LOCATE('?',loser.public_path)=0 AND LOCATE('?',winner.public_path)=0
        AND LOCATE('#',loser.public_path)=0 AND LOCATE('#',winner.public_path)=0`);
    await q.query(
      `DELETE l FROM seo_listing_pages l JOIN seo_listing_reconcile r ON r.id=l.id WHERE r.duplicate_rank>1`,
    );
    await q.query('DROP TEMPORARY TABLE seo_listing_reconcile');
    await q.query(
      `UPDATE seo_listing_pages SET transaction_intent='buy' WHERE transaction_intent IN ('new','resale')`,
    );
    await q.query(
      `UPDATE seo_listing_pages SET filter_key=CONCAT(inventory_kind,':',transaction_intent,':',COALESCE(property_type,project_type,'all'),':',city_id,':',COALESCE(sublocation_id,0),':',COALESCE(bedrooms,0))`,
    );

    const checks: Array<{ CONSTRAINT_NAME: string }> = await q.query(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
       WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='seo_listing_pages'
         AND CONSTRAINT_TYPE='CHECK' AND CONSTRAINT_NAME IN ('chk_listing_intent','chk_listing_inventory')`,
    );
    for (const check of checks) {
      await q.query(
        `ALTER TABLE seo_listing_pages DROP CHECK \`${check.CONSTRAINT_NAME}\``,
      );
    }
    await q.query(
      "ALTER TABLE seo_listing_pages MODIFY transaction_intent ENUM('buy','rent') NOT NULL DEFAULT 'buy'",
    );
    await q.query(
      `ALTER TABLE seo_listing_pages ADD CONSTRAINT chk_listing_inventory CHECK (inventory_kind IN ('property','project') AND (inventory_kind<>'project' OR transaction_intent='buy'))`,
    );

    await q.query(`DELETE FROM seo_configs WHERE scope='template' AND
      (config_key LIKE 'template:listing:properties:new' OR config_key LIKE 'template:listing:properties:resale'
       OR config_key LIKE 'template:property:%:new' OR config_key LIKE 'template:property:%:resale'
       OR config_key LIKE 'template:listing:%:new' OR config_key LIKE 'template:listing:%:resale'
       OR config_key LIKE 'template:project:%:new' OR config_key LIKE 'template:project:%:resale')`);

    const types = [
      'apartment',
      'villa',
      'individual_portion',
      'plot',
      'farmland',
      'commercial',
      'industrial',
      'coworking',
    ];
    for (const type of types) {
      for (const intent of ['buy', 'rent']) {
        const transaction = intent === 'buy' ? 'Sale' : 'Rent';
        await q.query(
          `INSERT INTO seo_configs
          (config_key,scope,meta_title,meta_description,h1,section_seo,settings)
          VALUES (?,'template',?,?,?,?,?)
          ON DUPLICATE KEY UPDATE meta_title=VALUES(meta_title),meta_description=VALUES(meta_description),h1=VALUES(h1),
            section_seo=JSON_MERGE_PATCH(VALUES(section_seo),COALESCE(section_seo,JSON_OBJECT())),settings=VALUES(settings)`,
          [
            `template:property:${type}:${intent}`,
            `{BHK} {Property_Type} for ${transaction} in {Sub_Locality}, {City} ({SqFt} Sq.Ft) - {Property_Name} | Majestan Realty`,
            `Explore {Property_Type} for ${transaction} in {Sub_Locality}, {City}. Compare prices, photographs and property details with Majestan Realty.`,
            `{BHK} {Property_Type} for ${transaction} in {Sub_Locality}, {City}`,
            JSON.stringify({
              'floor-plan': {
                metaTitle: '{Property_Name} Floor Plans | Majestan Realty',
                metaDescription:
                  'Explore the floor plans and layouts for {Property_Name} in {City}.',
                h1: 'Floor Plans for {Property_Name}',
                canonicalUrl: '',
              },
              photos: {
                metaTitle: 'Photos of {Property_Name} | Majestan Realty',
                metaDescription: 'View photos of {Property_Name} in {City}.',
                h1: 'Photos of {Property_Name}',
                canonicalUrl: '',
              },
            }),
            JSON.stringify({ scope: 'property', property_type: type, intent }),
          ],
        );
        await q.query(
          `INSERT INTO seo_configs
          (config_key,scope,meta_title,meta_description,h1,settings)
          VALUES (?,'template',?,?,?,?)
          ON DUPLICATE KEY UPDATE meta_title=VALUES(meta_title),meta_description=VALUES(meta_description),h1=VALUES(h1),settings=VALUES(settings)`,
          [
            `template:listing:${type}:${intent}`,
            `{Property_Type} for ${transaction} in {Sub_Locality}, {City} | Majestan Realty`,
            `Explore {Property_Type} for ${transaction} in {Sub_Locality}, {City}. Compare current listings and prices with Majestan Realty.`,
            `{Property_Type} for ${transaction} in {Sub_Locality}, {City}`,
            JSON.stringify({ scope: 'listing', property_type: type, intent }),
          ],
        );
      }
    }
    for (const intent of ['buy', 'rent']) {
      const transaction = intent === 'buy' ? 'Sale' : 'Rent';
      await q.query(
        `INSERT INTO seo_configs (config_key,scope,meta_title,meta_description,h1,settings)
        VALUES (?,'template',?,?,?,?) ON DUPLICATE KEY UPDATE meta_title=VALUES(meta_title),meta_description=VALUES(meta_description),h1=VALUES(h1),settings=VALUES(settings)`,
        [
          `template:listing:properties:${intent}`,
          `Properties for ${transaction} in {Sub_Locality}, {City} | Majestan Realty`,
          `Explore properties for ${transaction.toLowerCase()} in {Sub_Locality}, {City}. Compare current listings and prices with Majestan Realty.`,
          `Properties for ${transaction} in {Sub_Locality}, {City}`,
          JSON.stringify({ scope: 'listing', intent, property_type: null }),
        ],
      );
    }
    for (const type of ['apartment', 'villa', 'plot']) {
      await q.query(
        `INSERT INTO seo_configs
        (config_key,scope,meta_title,meta_description,h1,section_seo,settings)
        VALUES (?,'template',?,?,?,?,?) ON DUPLICATE KEY UPDATE meta_title=VALUES(meta_title),meta_description=VALUES(meta_description),h1=VALUES(h1),
          section_seo=JSON_MERGE_PATCH(VALUES(section_seo),COALESCE(section_seo,JSON_OBJECT())),settings=VALUES(settings)`,
        [
          `template:project:${type}:buy`,
          '{Project_Name} in {Sub_Locality}, {City} | {BHK} {Project_Type} for Sale from {Min_Price} | Majestan Realty',
          'Explore {Project_Name} by {Builder} in {Sub_Locality}, {City}. View configurations, prices, RERA details and project highlights.',
          '{Project_Name} in {Sub_Locality}, {City}',
          JSON.stringify({
            'floor-plans': {
              metaTitle:
                'Floor Plans for {Project_Name} in {City} | Majestan Realty',
              metaDescription:
                'Explore configurations and floor plans for {Project_Name} in {City}.',
              h1: 'Floor Plans for {Project_Name}',
              canonicalUrl: '',
            },
            photos: {
              metaTitle: 'Photos of {Project_Name} in {City} | Majestan Realty',
              metaDescription: 'View photos of {Project_Name} in {City}.',
              h1: 'Photos of {Project_Name}',
              canonicalUrl: '',
            },
          }),
          JSON.stringify({
            scope: 'project',
            project_type: type,
            intent: 'buy',
          }),
        ],
      );
    }
  }

  async down(_q: QueryRunner): Promise<void> {
    // Data reconciliation is intentionally forward-only: template edits and
    // merged buy rules cannot be safely reversed without restoring a snapshot.
  }
}
