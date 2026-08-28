import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddListingPageSeoTable1756540000000 implements MigrationInterface {
  name = 'AddListingPageSeoTable1756540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE \`listing_page_seo\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`page_key\` varchar(512) NOT NULL,
        \`meta_title\` varchar(255) NULL,
        \`meta_description\` varchar(320) NULL,
        \`h1\` varchar(255) NULL,
        \`og_title\` varchar(255) NULL,
        \`og_description\` varchar(320) NULL,
        \`og_image_url\` varchar(1024) NULL,
        \`robots_index\` tinyint NOT NULL DEFAULT 1,
        \`robots_follow\` tinyint NOT NULL DEFAULT 1,
        \`custom_content\` text NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`idx_listing_page_seo_page_key\` (\`page_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`listing_page_seo\``);
  }
}
