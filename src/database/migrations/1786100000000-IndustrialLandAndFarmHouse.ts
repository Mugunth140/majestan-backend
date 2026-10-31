import { MigrationInterface, QueryRunner } from 'typeorm';

export class IndustrialLandAndFarmHouse1786100000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    const rows = await q.query("SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'property_type'");
    const enumType = String(rows[0]?.columnType ?? '');
    if (!enumType.includes("'farm_house'")) {
      if (!enumType.startsWith('enum(')) throw new Error('Property type enum was not found.');
      await q.query(`ALTER TABLE properties MODIFY property_type ${enumType.slice(0, -1)},'farm_house') NOT NULL DEFAULT 'other'`);
    }
    await q.query('ALTER TABLE properties MODIFY price_per_sqft DECIMAL(24,10) NULL');
    await q.query('ALTER TABLE property_details MODIFY property_use TEXT NULL, MODIFY building_approval_cert TEXT NULL');
    if (!(await q.hasColumn('property_details', 'container_access'))) await q.query('ALTER TABLE property_details ADD COLUMN container_access VARCHAR(30) NULL');
    if (!(await q.hasColumn('property_details', 'labor_rooms'))) await q.query('ALTER TABLE property_details ADD COLUMN labor_rooms INT NULL');
    if (!(await q.hasColumn('property_details', 'toilets'))) await q.query('ALTER TABLE property_details ADD COLUMN toilets INT NULL');
    if (!(await q.hasColumn('property_details', 'borewell_count'))) await q.query('ALTER TABLE property_details ADD COLUMN borewell_count INT NULL');
    if (!(await q.hasColumn('property_details', 'plot_boundaries'))) await q.query('ALTER TABLE property_details ADD COLUMN plot_boundaries JSON NULL');
  }
  async down(): Promise<void> { /* Preserve user-entered values and Farm House records. */ }
}
