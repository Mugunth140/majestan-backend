import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds an editorial description to sublocations, powering
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
