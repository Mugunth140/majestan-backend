import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves projects to root-level custom slugs: canonical_slug = slug.
 * Both columns are UNIQUE so this is safe on existing rows.
 */
export class ProjectRootCustomSlug1781800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`canonical_slug\` = \`slug\`
      WHERE \`canonical_slug\` != \`slug\`
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`canonical_slug\` = CONCAT('projects/', LOWER(\`city\`), '/', \`slug\`)
    `);
  }
}
