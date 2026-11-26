import { MigrationInterface, QueryRunner } from 'typeorm';

/** "Individual Portion": one floor or part of a house, separate from an independent house. */
export class AddPortionPropertyType1786800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Keep in sync with infra/migrations/089_add_portion_property_type.sql.
    const rows = await q.query("SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'property_type'");
    const enumType = String(rows[0]?.columnType ?? '');
    if (enumType.includes("'portion'")) return;
    if (!enumType.startsWith('enum(')) throw new Error('Property type enum was not found.');
    await q.query(`ALTER TABLE properties MODIFY property_type ${enumType.slice(0, -1)},'portion') NOT NULL DEFAULT 'other'`);
  }

  async down(q: QueryRunner): Promise<void> {
    const rows = await q.query("SELECT COUNT(*) AS total FROM properties WHERE property_type = 'portion'");
    if (Number(rows[0]?.total) > 0) throw new Error('Individual Portion listings must be moved before removing this property type.');
    const [col] = await q.query("SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'property_type'");
    await q.query(`ALTER TABLE properties MODIFY property_type ${String(col.columnType).replace(",'portion'", '')} NOT NULL DEFAULT 'other'`);
  }
}
