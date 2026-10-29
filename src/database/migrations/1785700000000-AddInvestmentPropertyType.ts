import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInvestmentPropertyType1785700000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Keep in sync with infra/migrations/054_add_investment_property.sql.
    const rows = await q.query("SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'property_type'");
    const enumType = String(rows[0]?.columnType ?? '');
    if (enumType.includes("'investment_property'")) return;
    if (!enumType.startsWith('enum(')) throw new Error('Property type enum was not found.');
    await q.query(`ALTER TABLE properties MODIFY property_type ${enumType.slice(0, -1)},'investment_property') NOT NULL DEFAULT 'other'`);
  }

  async down(q: QueryRunner): Promise<void> {
    const rows = await q.query("SELECT COUNT(*) AS total FROM properties WHERE property_type = 'investment_property'");
    if (Number(rows[0]?.total) > 0) {
      throw new Error('Investment Property listings must be migrated before removing this property type.');
    }
    await q.query("ALTER TABLE properties MODIFY property_type ENUM('apartment','villa','individual_portion','plot','farmland','commercial','industrial','coworking','other') NOT NULL DEFAULT 'other'");
  }
}
