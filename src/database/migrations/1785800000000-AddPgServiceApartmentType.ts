import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPgServiceApartmentType1785800000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // Infra deployments may already have applied 055_add_pg_service_apartment.sql.
    const rows = await q.query("SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'property_type'");
    const enumType = String(rows[0]?.columnType ?? '');
    if (enumType.includes("'pg_service_apartment'")) return;
    if (!enumType.startsWith('enum(')) throw new Error('Property type enum was not found.');
    await q.query(`ALTER TABLE properties MODIFY property_type ${enumType.slice(0, -1)},'pg_service_apartment') NOT NULL DEFAULT 'other'`);
  }

  async down(q: QueryRunner): Promise<void> {
    const rows = await q.query("SELECT COUNT(*) AS total FROM properties WHERE property_type = 'pg_service_apartment'");
    if (Number(rows[0]?.total) > 0) {
      throw new Error('PG / Service Apartment listings must be migrated before removing this property type.');
    }
    const columns = await q.query("SELECT COLUMN_TYPE AS columnType FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'properties' AND COLUMN_NAME = 'property_type'");
    const enumType = String(columns[0]?.columnType ?? '');
    if (!enumType.includes("'pg_service_apartment'")) return;
    await q.query(`ALTER TABLE properties MODIFY property_type ${enumType.replace(",'pg_service_apartment'", '')} NOT NULL DEFAULT 'other'`);
  }
}
