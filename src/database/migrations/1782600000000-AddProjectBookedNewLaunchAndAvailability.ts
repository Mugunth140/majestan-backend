import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * - Project booking lifecycle: adds `booked` to the unit status enum
 *   (project_units + property_units share the PropertyUnitStatus enum).
 * - Project launch lifecycle: adds `new_launch` to projects.possession_status.
 * - Project availability window: available_from / available_until dates.
 */
export class AddProjectBookedNewLaunchAndAvailability1782600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`project_units\`
      MODIFY COLUMN \`status\` enum('available', 'reserved', 'booked', 'sold', 'rented', 'inactive') NOT NULL DEFAULT 'available'
    `);
    await queryRunner.query(`
      ALTER TABLE \`property_units\`
      MODIFY COLUMN \`status\` enum('available', 'reserved', 'booked', 'sold', 'rented', 'inactive') NOT NULL DEFAULT 'available'
    `);
    await queryRunner.query(`
      ALTER TABLE \`projects\`
      MODIFY COLUMN \`possession_status\` enum('under_construction', 'ready_to_move', 'new_launch') NOT NULL DEFAULT 'under_construction',
      MODIFY COLUMN \`status\` enum('draft', 'published', 'archived', 'booked') NOT NULL DEFAULT 'draft',
      MODIFY COLUMN \`project_type\` enum('apartment', 'villa', 'plot') NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`projects\`
      MODIFY COLUMN \`project_type\` enum('apartment', 'villa') NOT NULL,
      MODIFY COLUMN \`status\` enum('draft', 'published', 'archived') NOT NULL DEFAULT 'draft',
      MODIFY COLUMN \`possession_status\` enum('under_construction', 'ready_to_move') NOT NULL DEFAULT 'under_construction'
    `);
    await queryRunner.query(`
      ALTER TABLE \`property_units\`
      MODIFY COLUMN \`status\` enum('available', 'reserved', 'sold', 'rented', 'inactive') NOT NULL DEFAULT 'available'
    `);
    await queryRunner.query(`
      ALTER TABLE \`project_units\`
      MODIFY COLUMN \`status\` enum('available', 'reserved', 'sold', 'rented', 'inactive') NOT NULL DEFAULT 'available'
    `);
  }
}
