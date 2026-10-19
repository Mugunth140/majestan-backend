import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeoCommandCenter1784600000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE IF NOT EXISTS seo_configs (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      config_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      scope ENUM('project','property','listing','page','template','technical') NOT NULL,
      project_id INT UNSIGNED NULL, property_id INT UNSIGNED NULL,
      public_path VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NULL,
      canonical_url VARCHAR(1024) NULL,
      meta_title VARCHAR(255) NULL, meta_description VARCHAR(320) NULL,
      h1 VARCHAR(255) NULL, h2 VARCHAR(255) NULL,
      og_title VARCHAR(255) NULL, og_description VARCHAR(320) NULL, og_image_url VARCHAR(1024) NULL,
      robots_index BOOLEAN NOT NULL DEFAULT TRUE, robots_follow BOOLEAN NOT NULL DEFAULT TRUE,
      priority_indexing BOOLEAN NOT NULL DEFAULT FALSE,
      highlights JSON NULL, faqs JSON NULL, schema_overrides JSON NULL,
      image_alt_overrides JSON NULL, section_seo JSON NULL, settings JSON NULL,
      revision INT UNSIGNED NOT NULL DEFAULT 1,
      created_by_crm_id INT NULL, updated_by_crm_id INT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE KEY uq_seo_config_key (config_key), UNIQUE KEY uq_seo_public_path (public_path),
      UNIQUE KEY uq_seo_property (property_id), UNIQUE KEY uq_seo_project (project_id),
      CONSTRAINT fk_seo_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
      CONSTRAINT fk_seo_project FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await q.query(`CREATE TABLE IF NOT EXISTS seo_listing_pages (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      seo_config_id INT UNSIGNED NOT NULL,
      transaction_intent ENUM('buy','rent') NOT NULL DEFAULT 'buy',
      inventory_kind ENUM('property','project') NOT NULL DEFAULT 'property',
      property_type VARCHAR(32) NULL, project_type VARCHAR(32) NULL,
      city_id INT UNSIGNED NOT NULL, sublocation_id INT UNSIGNED NULL,
      bedrooms TINYINT UNSIGNED NULL,
      filter_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      intro_content TEXT NULL, bottom_content LONGTEXT NULL, faqs JSON NULL,
      auto_stats_faqs BOOLEAN NOT NULL DEFAULT TRUE,
      thin_content_guard_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      minimum_active_listings INT UNSIGNED NOT NULL DEFAULT 2,
      pinned_indexable BOOLEAN NOT NULL DEFAULT FALSE,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE KEY uq_seo_listing_config (seo_config_id), UNIQUE KEY uq_seo_listing_filter (filter_key),
      CONSTRAINT fk_listing_config FOREIGN KEY (seo_config_id) REFERENCES seo_configs(id) ON DELETE CASCADE,
      CONSTRAINT fk_listing_city FOREIGN KEY (city_id) REFERENCES cities(id) ON DELETE RESTRICT,
      CONSTRAINT fk_listing_locality FOREIGN KEY (sublocation_id) REFERENCES sublocations(id) ON DELETE RESTRICT,
      CONSTRAINT chk_listing_inventory CHECK (inventory_kind IN ('property','project') AND (inventory_kind<>'project' OR transaction_intent='buy'))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await q.query(`CREATE TABLE IF NOT EXISTS seo_redirects (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      source_path VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      destination_path VARCHAR(512) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
      status_code SMALLINT NOT NULL DEFAULT 301,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      reason VARCHAR(32) NOT NULL DEFAULT 'manual',
      created_by_crm_id INT NULL, updated_by_crm_id INT NULL,
      created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
      updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
      UNIQUE KEY uq_seo_redirect_source (source_path),
      CONSTRAINT chk_seo_redirect_code CHECK (status_code=301),
      CONSTRAINT chk_seo_redirect_self CHECK (source_path<>destination_path)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    // Preserve every legacy section, even when overview fields are absent.
    for (const [table, kind] of [
      ['property_seo', 'property'],
      ['project_seo', 'project'],
    ]) {
      await q.query(`INSERT IGNORE INTO seo_configs
        (config_key,scope,${kind}_id,meta_title,meta_description,h1,og_title,og_description,og_image_url,section_seo,faqs,robots_index,robots_follow)
        SELECT CONCAT('${kind}:',${kind}_id),'${kind}',${kind}_id,
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(seo_data,'$.overview.title')),'null'),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(seo_data,'$.overview.description')),'null'),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(seo_data,'$.overview.h1')),'null'),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(seo_data,'$.overview.og_title')),'null'),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(seo_data,'$.overview.og_description')),'null'),
        NULLIF(JSON_UNQUOTE(JSON_EXTRACT(seo_data,'$.overview.og_image')),'null'),seo_data,
        JSON_EXTRACT(seo_data,'$.faqs'),
        CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(seo_data,'$.overview.robots')) LIKE '%noindex%' THEN 0 ELSE 1 END,
        CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(seo_data,'$.overview.robots')) LIKE '%nofollow%' THEN 0 ELSE 1 END
        FROM ${table}`);
    }
    // The legacy listing editor allowed arbitrary page paths. Keep those
    // usable as path-based overrides; filter rules can be attached later.
    await q.query(`INSERT IGNORE INTO seo_configs
      (config_key,scope,public_path,meta_title,meta_description,h1,og_title,og_description,og_image_url,robots_index,robots_follow,settings)
      SELECT CONCAT('legacy-listing:',id),'listing',CONCAT('/',TRIM(BOTH '/' FROM page_key)),
      meta_title,meta_description,h1,og_title,og_description,og_image_url,robots_index,robots_follow,
      JSON_OBJECT('legacy_bottom_content',custom_content) FROM listing_page_seo`);
    await q.query(`INSERT IGNORE INTO seo_configs
      (config_key,scope,property_id,public_path,canonical_url,meta_title,meta_description,og_title,og_description,og_image_url,robots_index,robots_follow,schema_overrides)
      SELECT CONCAT('legacy:',entity_type,':',entity_id),
      IF(entity_type='property','property','page'), IF(entity_type='property',entity_id,NULL),
      CONCAT('/',TRIM(BOTH '/' FROM slug)),canonical_url,meta_title,meta_description,og_title,og_description,
      og_image_url,robots_index,robots_follow,schema_json FROM seo_metadata`);

    // Merge a secondary legacy metadata row without discarding either source.
    await q.query(`UPDATE seo_configs c JOIN seo_metadata m ON m.entity_type='property' AND m.entity_id=c.property_id
      SET c.meta_title=COALESCE(c.meta_title,m.meta_title),c.meta_description=COALESCE(c.meta_description,m.meta_description),
      c.canonical_url=COALESCE(c.canonical_url,m.canonical_url),c.og_title=COALESCE(c.og_title,m.og_title),
      c.og_description=COALESCE(c.og_description,m.og_description),c.og_image_url=COALESCE(c.og_image_url,m.og_image_url),
      c.schema_overrides=COALESCE(c.schema_overrides,m.schema_json),
      c.settings=JSON_SET(COALESCE(c.settings,JSON_OBJECT()),'$.legacy_metadata',JSON_OBJECT('slug',m.slug,'meta_keywords',m.meta_keywords))`);

    // Keep the last known public path when CRM later deletes the inventory.
    await q.query(
      `UPDATE seo_configs c JOIN properties p ON p.id=c.property_id SET c.public_path=CONCAT('/',TRIM(BOTH '/' FROM p.slug)) WHERE c.public_path IS NULL AND p.slug IS NOT NULL AND p.slug<>''`,
    );
    await q.query(
      `UPDATE seo_configs c JOIN projects p ON p.id=c.project_id SET c.public_path=CONCAT('/',TRIM(BOTH '/' FROM p.canonical_slug)) WHERE c.public_path IS NULL AND p.canonical_slug<>''`,
    );
    for (const intent of ['buy', 'rent']) {
      const sale = intent === 'buy';
      await q.query(
        `INSERT IGNORE INTO seo_configs (config_key,scope,meta_title,meta_description,h1,settings) VALUES (?,'template',?,?,?,?)`,
        [
          `template:listing:properties:${intent}`,
          `Properties for ${sale ? 'Sale' : 'Rent'} in {Sub_Locality}, {City} | Majestan Realty`,
          `Explore properties for ${sale ? 'sale' : 'rent'} in {Sub_Locality}, {City}. Compare current listings and prices with Majestan Realty.`,
          `Properties for ${sale ? 'Sale' : 'Rent'} in {Sub_Locality}, {City}`,
          JSON.stringify({ scope: 'listing', intent, property_type: null }),
        ],
      );
    }

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
    for (const scope of ['property', 'listing']) {
      for (const type of types) {
        for (const intent of ['buy', 'rent']) {
          const transaction = intent === 'buy' ? 'Sale' : 'Rent';
          const title =
            scope === 'property'
              ? `{BHK} {Property_Type} for ${transaction} in {Sub_Locality}, {City} ({SqFt} Sq.Ft) - {Property_Name} | Majestan Realty`
              : `{Property_Type} for ${transaction} in {Sub_Locality}, {City} | Majestan Realty`;
          await q.query(
            `INSERT IGNORE INTO seo_configs
            (config_key,scope,meta_title,meta_description,h1,section_seo,settings) VALUES (?,'template',?,?,?,?,?)`,
            [
              `template:${scope}:${type}:${intent}`,
              title,
              `Explore {Property_Type} for ${transaction} in {Sub_Locality}, {City}. Compare prices, photographs and property details with Majestan Realty.`,
              `{Property_Type} for ${transaction} in {Sub_Locality}, {City}`,
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
              JSON.stringify({ scope, property_type: type, intent }),
            ],
          );
        }
      }
    }
    for (const type of ['apartment', 'villa', 'plot']) {
      await q.query(
        `INSERT IGNORE INTO seo_configs (config_key,scope,meta_title,meta_description,h1,section_seo,settings)
        VALUES (?,'template',?,?,?,?,?)`,
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
    for (const path of [
      '/',
      '/projects',
      '/about-us',
      '/contact-us',
      '/services/property-management',
      '/services/liaisoning',
      '/services/financial-assistance',
      '/services/nri-property-investment',
      '/services/professional-brokerage-services',
      '/sell-property',
      '/rent-property',
    ]) {
      await q.query(
        `INSERT IGNORE INTO seo_configs (config_key,scope,public_path) VALUES (?,'page',?)`,
        [`page:${path}`, path],
      );
    }
    await q.query(
      `INSERT IGNORE INTO seo_configs (config_key,scope,settings) VALUES ('technical:site','technical',?)`,
      [
        JSON.stringify({
          robots_txt:
            'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nUser-agent: OAI-SearchBot\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nUser-agent: GPTBot\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nUser-agent: PerplexityBot\nAllow: /\nDisallow: /admin\nDisallow: /api\n\nSitemap: https://www.majestanrealty.com/sitemap.xml\n',
          organization: {
            name: 'Majestan Realty',
            telephone: '+91 90929 65556',
            streetAddress:
              '47/1 Aandal Street, Lakshmipuram Main Rd, Hope College',
            addressLocality: 'Coimbatore',
            addressRegion: 'Tamil Nadu',
            postalCode: '641004',
            addressCountry: 'IN',
          },
        }),
      ],
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query('DROP TABLE IF EXISTS seo_redirects');
    await q.query('DROP TABLE IF EXISTS seo_listing_pages');
    await q.query('DROP TABLE IF EXISTS seo_configs');
  }
}
