import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPropertySeoTable1781500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the property_seo table
    await queryRunner.query(`
      CREATE TABLE \`property_seo\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`property_id\` int unsigned NOT NULL,
        \`seo_data\` json NOT NULL,
        \`verification_status\` varchar(50) NOT NULL DEFAULT 'Pending',
        \`approval_status\` varchar(50) NOT NULL DEFAULT 'Pending',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_property_seo_property_id\` (\`property_id\`),
        CONSTRAINT \`fk_property_seo_property\` FOREIGN KEY (\`property_id\`) REFERENCES \`properties\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. Migrate existing meta fields into seo_data JSON (overview section only)
    await queryRunner.query(`
      INSERT INTO \`property_seo\` (\`property_id\`, \`seo_data\`, \`verification_status\`, \`approval_status\`)
      SELECT
        p.id,
        JSON_OBJECT(
          'overview', JSON_OBJECT(
            'title', COALESCE(p.meta_title, ''),
            'description', COALESCE(p.meta_description, ''),
            'h1', COALESCE(p.meta_title, ''),
            'og_title', COALESCE(p.meta_title, ''),
            'og_description', COALESCE(p.meta_description, ''),
            'og_image', '',
            'robots', 'index,follow'
          ),
          'amenities', JSON_OBJECT('title', '', 'description', '', 'h1', '', 'og_title', '', 'og_description', '', 'og_image', '', 'robots', 'index,follow'),
          'floor_plan', JSON_OBJECT('title', '', 'description', '', 'h1', '', 'og_title', '', 'og_description', '', 'og_image', '', 'robots', 'index,follow'),
          'locality', JSON_OBJECT('title', '', 'description', '', 'h1', '', 'og_title', '', 'og_description', '', 'og_image', '', 'robots', 'index,follow', 'content_overview', '', 'content_connectivity', '', 'content_education', '', 'content_healthcare', '', 'content_shopping', ''),
          'photos', JSON_OBJECT('title', '', 'description', '', 'h1', '', 'og_title', '', 'og_description', '', 'og_image', '', 'robots', 'noindex,follow')
        ),
        COALESCE(p.verification_status, 'Pending'),
        COALESCE(p.approval_status, 'Pending')
      FROM \`properties\` p
    `);

    // 3. Drop the old meta columns from properties table
    await queryRunner.query(`ALTER TABLE \`properties\` DROP COLUMN \`meta_title\``);
    await queryRunner.query(`ALTER TABLE \`properties\` DROP COLUMN \`meta_description\``);
    await queryRunner.query(`ALTER TABLE \`properties\` DROP COLUMN \`meta_keywords\``);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-add the columns
    await queryRunner.query(`ALTER TABLE \`properties\` ADD COLUMN \`meta_title\` varchar(255) NULL`);
    await queryRunner.query(`ALTER TABLE \`properties\` ADD COLUMN \`meta_description\` text NULL`);
    await queryRunner.query(`ALTER TABLE \`properties\` ADD COLUMN \`meta_keywords\` text NULL`);

    // Restore data from seo_data
    await queryRunner.query(`
      UPDATE \`properties\` p
      JOIN \`property_seo\` s ON s.property_id = p.id
      SET
        p.meta_title = JSON_UNQUOTE(JSON_EXTRACT(s.seo_data, '$.overview.title')),
        p.meta_description = JSON_UNQUOTE(JSON_EXTRACT(s.seo_data, '$.overview.description'))
    `);

    await queryRunner.query(`DROP TABLE IF EXISTS \`property_seo\``);
  }
}
