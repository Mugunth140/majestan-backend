import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Apartment/villa detail parity for projects (copied from the property
 * apartment/villa field set):
 * - projects: towers/structure, pincode + geo, highlights/specs, parking info
 * - project_amenities join table mirroring property_amenities
 * - project_units: UDS/plot areas, parking, pooja/study rooms, villa land
 *   fields (open sides, boundary wall), room dimensions
 * All columns nullable so existing rows are unaffected.
 */
export class AddProjectApartmentVillaDetails1782500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`projects\`
      ADD COLUMN \`total_floors\` smallint unsigned NULL,
      ADD COLUMN \`tower_details\` json NULL,
      ADD COLUMN \`project_area_sqft\` decimal(12,2) NULL,
      ADD COLUMN \`pincode\` varchar(20) NULL,
      ADD COLUMN \`latitude\` decimal(10,7) NULL,
      ADD COLUMN \`longitude\` decimal(10,7) NULL,
      ADD COLUMN \`highlights\` text NULL,
      ADD COLUMN \`specifications\` json NULL,
      ADD COLUMN \`brochure_key\` varchar(1024) NULL,
      ADD COLUMN \`brochure_name\` varchar(255) NULL
    `);
    await queryRunner.query(`
      CREATE TABLE \`project_amenities\` (
        \`project_id\` int unsigned NOT NULL,
        \`amenity_id\` int unsigned NOT NULL,
        \`availability\` enum('available', 'not_available', 'chargeable') NOT NULL DEFAULT 'available',
        \`notes\` varchar(255) NULL,
        \`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`project_id\`, \`amenity_id\`),
        INDEX \`idx_project_amenities_amenity_id\` (\`amenity_id\`),
        INDEX \`idx_project_amenities_availability\` (\`availability\`),
        CONSTRAINT \`FK_project_amenities_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`FK_project_amenities_amenity\` FOREIGN KEY (\`amenity_id\`) REFERENCES \`amenities\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`
      ALTER TABLE \`project_units\`
      ADD COLUMN \`uds_area_sqft\` decimal(12,2) NULL,
      ADD COLUMN \`plot_area_sqft\` decimal(12,2) NULL,
      ADD COLUMN \`parking\` tinyint unsigned NULL,
      ADD COLUMN \`parking_type\` varchar(20) NULL,
      ADD COLUMN \`unit_guest_parking\` tinyint(1) NULL,
      ADD COLUMN \`pooja_room\` tinyint(1) NULL,
      ADD COLUMN \`study_room\` tinyint(1) NULL,
      ADD COLUMN \`open_sides\` tinyint unsigned NULL,
      ADD COLUMN \`boundary_wall\` tinyint(1) NULL,
      ADD COLUMN \`room_dimensions\` json NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`project_units\`
      DROP COLUMN \`room_dimensions\`,
      DROP COLUMN \`boundary_wall\`,
      DROP COLUMN \`open_sides\`,
      DROP COLUMN \`study_room\`,
      DROP COLUMN \`pooja_room\`,
      DROP COLUMN \`unit_guest_parking\`,
      DROP COLUMN \`parking_type\`,
      DROP COLUMN \`parking\`,
      DROP COLUMN \`plot_area_sqft\`,
      DROP COLUMN \`uds_area_sqft\`
    `);
    await queryRunner.query(`DROP TABLE \`project_amenities\``);
    await queryRunner.query(`
      ALTER TABLE \`projects\`
      DROP COLUMN \`brochure_name\`,
      DROP COLUMN \`brochure_key\`,
      DROP COLUMN \`specifications\`,
      DROP COLUMN \`highlights\`,
      DROP COLUMN \`longitude\`,
      DROP COLUMN \`latitude\`,
      DROP COLUMN \`pincode\`,
      DROP COLUMN \`tower_details\`,
      DROP COLUMN \`total_floors\`,
      DROP COLUMN \`project_area_sqft\`
    `);
  }
}
