import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * SUPERSEDED — DO NOT REGISTER in data-source.ts.
 * This change is owned by infra/migrations/031_add_description_to_majestan_sublocations.sql,
 * which applies the same column idempotently through the infra migrate runner
 * (recorded in majestan_crm.schema_migrations). Registering this class as well
 * would fail on databases where 031 already added the column (duplicate column).
 *
 * Original intent: adds an editorial description to sublocations, powering
 * "Overview of {locality}" sections on the homepage and detail pages.
 */
export class AddSublocationDescription1782100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`sublocations\`
        ADD COLUMN \`description\` text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`sublocations\`
        DROP COLUMN \`description\`
    `);
  }
}
