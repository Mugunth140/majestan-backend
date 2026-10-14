import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

// New ad slots (home offers carousel, header mega menu), per-audience
// targeting, and an optional mobile creative for single-image slots.
export class ExtendAdPlacements1784000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "ALTER TABLE `ads` MODIFY `placement` ENUM('hero','offers','mega_menu','listing_feed','announcement','popup') NOT NULL DEFAULT 'hero'",
    );
    await queryRunner.query('ALTER TABLE `ads` MODIFY `mobile_image_key` VARCHAR(500) NULL');
    if (!(await queryRunner.hasColumn('ads', 'audience'))) {
      await queryRunner.addColumn('ads', new TableColumn({ name: 'audience', type: 'varchar', length: '20', isNullable: true }));
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('ads', 'audience')) await queryRunner.dropColumn('ads', 'audience');
    await queryRunner.query("DELETE FROM `ads` WHERE `placement` IN ('offers','mega_menu') OR `mobile_image_key` IS NULL");
    await queryRunner.query('ALTER TABLE `ads` MODIFY `mobile_image_key` VARCHAR(500) NOT NULL');
    await queryRunner.query(
      "ALTER TABLE `ads` MODIFY `placement` ENUM('hero','listing_feed','announcement','popup') NOT NULL DEFAULT 'hero'",
    );
  }
}
