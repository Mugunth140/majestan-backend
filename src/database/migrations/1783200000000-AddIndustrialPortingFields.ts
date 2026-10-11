import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Industrial porting fields for the old-CRM industrial_spaces Excel import.
 *
 * All columns are NULL-able so the migration is safe on existing rows.
 * The new property_details columns are consumed ONLY for
 * property_type='industrial' (CRM gates forwarding by type and the frontend
 * renders them in industrial-only sections).
 *
 * legacy_source_id / legacy_row_no are TEMP trial-import anchors: they store
 * the Excel `Industrial Space Id` (ISxxx) + row number so staff can backfill
 * photos from the old CRM later. A follow-up migration drops them once the
 * backfill is complete.
 *
 * Idempotent: every ADD only runs when the column is absent (local dev DDL
 * for these columns was applied out-of-band before this migration was
 * registered, so a plain ALTER would fail with ER_DUP_FIELDNAME there while
 * production still needs the full ALTER).
 */
export class AddIndustrialPortingFields1783200000000
  implements MigrationInterface
{
  private async addColumn(
    queryRunner: QueryRunner,
    table: string,
    column: string,
    definition: string,
  ): Promise<void> {
    const existing = await queryRunner.query(
      `SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`,
    );
    if (!existing || existing.length === 0) {
      await queryRunner.query(
        `ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`,
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumn(
      queryRunner,
      'properties',
      'legacy_source_id',
      'varchar(64) NULL',
    );
    await this.addColumn(
      queryRunner,
      'properties',
      'legacy_row_no',
      'int NULL',
    );
    await this.addColumn(
      queryRunner,
      'properties',
      'available_visit_time',
      'varchar(20) NULL',
    );

    const indexRows: Array<Record<string, unknown>> =
      await queryRunner.query(
        `SELECT COUNT(1) AS \`count\` FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'properties'
           AND INDEX_NAME = 'uq_properties_legacy_source'`,
      );
    if (Number(indexRows?.[0]?.['count'] ?? 0) === 0) {
      await queryRunner.query(`
        CREATE UNIQUE INDEX \`uq_properties_legacy_source\`
          ON \`properties\` (\`legacy_source_id\`)
      `);
    }

    await this.addColumn(
      queryRunner,
      'property_details',
      'power_supply_2',
      'varchar(50) NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'power_supply_3',
      'varchar(50) NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'ownership_proof_verified',
      'varchar(50) NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'building_approval_cert',
      'varchar(50) NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'pollution_clearance',
      'varchar(50) NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'blueprint_layout',
      'varchar(50) NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'other_legal_clearance',
      'varchar(255) NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'other_legal_details',
      'text NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'public_transport_access',
      'varchar(255) NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'truck_trailer_count',
      'int NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX \`uq_properties_legacy_source\` ON \`properties\``,
    );

    await queryRunner.query(`
      ALTER TABLE \`property_details\`
        DROP COLUMN \`truck_trailer_count\`,
        DROP COLUMN \`public_transport_access\`,
        DROP COLUMN \`other_legal_details\`,
        DROP COLUMN \`other_legal_clearance\`,
        DROP COLUMN \`blueprint_layout\`,
        DROP COLUMN \`pollution_clearance\`,
        DROP COLUMN \`building_approval_cert\`,
        DROP COLUMN \`ownership_proof_verified\`,
        DROP COLUMN \`power_supply_3\`,
        DROP COLUMN \`power_supply_2\`
    `);

    await queryRunner.query(`
      ALTER TABLE \`properties\`
        DROP COLUMN \`available_visit_time\`,
        DROP COLUMN \`legacy_row_no\`,
        DROP COLUMN \`legacy_source_id\`
    `);
  }
}
