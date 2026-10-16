import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Wishlist storage on the unified schema. The old wishlist code read the
 * legacy `wishlist` + per-type tables (apartment, villas…), which production
 * never had, so every save failed with a 500.
 */
export class CreateSavedListings1784500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('saved_listings')) return;
    await queryRunner.query(`
      CREATE TABLE \`saved_listings\` (
        \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`owner_key\` VARCHAR(64) NOT NULL,
        \`listing_kind\` ENUM('property', 'project') NOT NULL,
        \`listing_id\` INT UNSIGNED NOT NULL,
        \`listing_type\` VARCHAR(32) NOT NULL,
        \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_saved_listings_owner_listing\` (\`owner_key\`, \`listing_kind\`, \`listing_id\`),
        KEY \`idx_saved_listings_owner\` (\`owner_key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('saved_listings')) {
      await queryRunner.query('DROP TABLE `saved_listings`');
    }
  }
}
