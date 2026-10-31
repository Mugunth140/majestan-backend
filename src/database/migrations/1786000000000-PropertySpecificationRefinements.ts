import { MigrationInterface, QueryRunner } from 'typeorm';

export class PropertySpecificationRefinements1786000000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasColumn('property_details', 'measurement_units'))) await q.query('ALTER TABLE property_details ADD COLUMN measurement_units JSON NULL');
    if (!(await q.hasColumn('property_details', 'plot_facing'))) await q.query('ALTER TABLE property_details ADD COLUMN plot_facing VARCHAR(100) NULL');
    if (!(await q.hasColumn('property_details', 'has_ground_floor'))) await q.query('ALTER TABLE property_details ADD COLUMN has_ground_floor TINYINT(1) NULL');
    if (!(await q.hasColumn('property_details', 'number_of_portions'))) await q.query('ALTER TABLE property_details ADD COLUMN number_of_portions INT NULL');
    if (!(await q.hasColumn('property_details', 'funded_by'))) await q.query('ALTER TABLE property_details ADD COLUMN funded_by VARCHAR(100) NULL');
  }
  async down(): Promise<void> { /* Preserve user-entered specification values on rollback. */ }
}
