import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds `bareshell` to the unit furnished_status vocabulary (matches the
 * property BARESHELL furnishing status). Applies to both unit tables, which
 * share the FurnishedStatus enum.
 */
export class AddBareshellFurnishedStatus1782700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`project_units\`
      MODIFY COLUMN \`furnished_status\` enum('unfurnished', 'semi_furnished', 'fully_furnished', 'bareshell') NULL
    `);
    await queryRunner.query(`
      ALTER TABLE \`property_units\`
      MODIFY COLUMN \`furnished_status\` enum('unfurnished', 'semi_furnished', 'fully_furnished', 'bareshell') NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`property_units\`
      MODIFY COLUMN \`furnished_status\` enum('unfurnished', 'semi_furnished', 'fully_furnished') NULL
    `);
    await queryRunner.query(`
      ALTER TABLE \`project_units\`
      MODIFY COLUMN \`furnished_status\` enum('unfurnished', 'semi_furnished', 'fully_furnished') NULL
    `);
  }
}
