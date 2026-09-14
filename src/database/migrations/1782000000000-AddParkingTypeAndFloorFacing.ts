import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds parking_type (Covered/Open) and floor_facing columns to
 * property_details. Both nullable so existing rows are unaffected.
 */
export class AddParkingTypeAndFloorFacing1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`property_details\`
      ADD COLUMN \`parking_type\` varchar(20) NULL,
      ADD COLUMN \`floor_facing\` varchar(50) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`property_details\`
      DROP COLUMN \`parking_type\`,
      DROP COLUMN \`floor_facing\`
    `);
  }
}
