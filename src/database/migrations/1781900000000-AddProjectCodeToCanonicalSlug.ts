import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Updates canonical_slug for all existing projects to the new flat format:
 *   canonical_slug = slug + '-' + LOWER(project_code)
 *
 * This makes project detail URLs look like property URLs:
 *   domain.com/prestige-park-grove-pra0042   (project)
 *   domain.com/property-name-slug            (property)
 *
 * Projects without a project_code (should not exist after AddProjectCodeColumn
 * migration, but guarded here) keep canonical_slug = slug.
 *
 * Down: reverts to canonical_slug = slug (the previous state set by
 * ProjectRootCustomSlug1781800000000).
 */
export class AddProjectCodeToCanonicalSlug1781900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Projects with a project_code: slug-<code-lowercase>
    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`canonical_slug\` = CONCAT(\`slug\`, '-', LOWER(\`project_code\`))
      WHERE \`project_code\` IS NOT NULL
        AND \`project_code\` != ''
    `);

    // Projects without a project_code (edge case): keep canonical_slug = slug
    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`canonical_slug\` = \`slug\`
      WHERE \`project_code\` IS NULL
         OR \`project_code\` = ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to the flat slug-only form (no code suffix)
    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`canonical_slug\` = \`slug\`
    `);
  }
}
