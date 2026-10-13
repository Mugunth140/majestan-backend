import { MigrationInterface, QueryRunner } from 'typeorm';

// Project unit types now run to 10 BHK. Both unit tables share the
// PropertyUnitType value set, so both columns move together. Existing rows
// are unaffected (only new allowed values are added).
const FULL_UNIT_TYPE_ENUM = `'studio','1bhk','2bhk','3bhk','4bhk','5bhk','6bhk','7bhk','8bhk','9bhk','10bhk','penthouse','villa_unit','plot_unit','office_unit','shop_unit','warehouse_unit','other','apartment','villa','commercial','plot'`;

const PREV_UNIT_TYPE_ENUM = `'studio','1bhk','2bhk','3bhk','4bhk','penthouse','villa_unit','plot_unit','office_unit','shop_unit','warehouse_unit','other','apartment','villa','commercial','plot'`;

export class AddHigherBhkUnitTypes1783700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`project_units\` MODIFY COLUMN \`unit_type\` ENUM(${FULL_UNIT_TYPE_ENUM}) NOT NULL DEFAULT 'other'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`property_units\` MODIFY COLUMN \`unit_type\` ENUM(${FULL_UNIT_TYPE_ENUM}) NOT NULL DEFAULT 'other'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`project_units\` MODIFY COLUMN \`unit_type\` ENUM(${PREV_UNIT_TYPE_ENUM}) NOT NULL DEFAULT 'other'`,
    );
    await queryRunner.query(
      `ALTER TABLE \`property_units\` MODIFY COLUMN \`unit_type\` ENUM(${PREV_UNIT_TYPE_ENUM}) NOT NULL DEFAULT 'other'`,
    );
  }
}
