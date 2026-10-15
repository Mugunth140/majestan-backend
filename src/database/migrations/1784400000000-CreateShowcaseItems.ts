import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateShowcaseItems1784400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('showcase_items')) return;
    await queryRunner.query(`
      CREATE TABLE \`showcase_items\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`section\` ENUM('handpicked_properties', 'featured_projects') NOT NULL,
        \`item_id\` INT UNSIGNED NOT NULL,
        \`sort_order\` INT NOT NULL DEFAULT 0,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_showcase_items_section_item\` (\`section\`, \`item_id\`),
        KEY \`idx_showcase_items_section_sort\` (\`section\`, \`sort_order\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('showcase_items')) {
      await queryRunner.query('DROP TABLE `showcase_items`');
    }
  }
}
