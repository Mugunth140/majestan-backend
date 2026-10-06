import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes property_details.furnished nullable so "never specified" (NULL,
 * row hides) stays distinct from an explicit Unfurnished choice (FALSE).
 * Existing rows are untouched.
 */
export class MakeFurnishedNullable1782200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`property_details\`
      MODIFY COLUMN \`furnished\` tinyint(1) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`property_details\` SET \`furnished\` = 0 WHERE \`furnished\` IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE \`property_details\`
      MODIFY COLUMN \`furnished\` tinyint(1) NOT NULL
    `);
  }
}
