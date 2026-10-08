import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Furnishing items master (staff-curated, e.g. Sofa / TV with a picked
 * icon) plus the property_furnishings join. Mirrors amenities tables.
 */
export class CreateFurnishingItems1782300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`furnishing_items\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(120) NOT NULL,
        \`slug\` varchar(140) NOT NULL,
        \`icon\` varchar(100) NULL,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_furnishing_items_slug\` (\`slug\`),
        UNIQUE KEY \`uq_furnishing_items_name\` (\`name\`),
        KEY \`idx_furnishing_items_is_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`property_furnishings\` (
        \`property_id\` int unsigned NOT NULL,
        \`furnishing_item_id\` int unsigned NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`property_id\`, \`furnishing_item_id\`),
        KEY \`idx_property_furnishings_item_id\` (\`furnishing_item_id\`),
        CONSTRAINT \`fk_property_furnishings_property\` FOREIGN KEY (\`property_id\`) REFERENCES \`properties\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT \`fk_property_furnishings_item\` FOREIGN KEY (\`furnishing_item_id\`) REFERENCES \`furnishing_items\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `property_furnishings`');
    await queryRunner.query('DROP TABLE IF EXISTS `furnishing_items`');
  }
}
