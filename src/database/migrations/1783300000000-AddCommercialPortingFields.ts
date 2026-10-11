import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Commercial porting fields for the old-CRM commercial_spaces Excel import.
 *
 * All columns are NULL-able so the migration is safe on existing rows.
 * The new columns are consumed ONLY for property_type='commercial'
 * (CRM gates forwarding by type and the frontend renders them in
 * commercial-only sections).
 *
 * Idempotent: every ADD only runs when the column is absent, so the
 * migration heals out-of-band DDL and still applies fully on fresh targets.
 */
export class AddCommercialPortingFields1783300000000
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
      'property_details',
      'shared_washrooms',
      'int NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'individual_washrooms',
      'int NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'construction_date',
      'varchar(100) NULL',
    );
    await this.addColumn(
      queryRunner,
      'property_details',
      'document_require',
      'varchar(255) NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`property_details\`
        DROP COLUMN \`document_require\`,
        DROP COLUMN \`construction_date\`,
        DROP COLUMN \`individual_washrooms\`,
        DROP COLUMN \`shared_washrooms\`
    `);
  }
}
