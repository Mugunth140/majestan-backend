import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * New project ID scheme (2-letter type prefix + zero-padded DB id):
 *   apartment → PA{id:04d}   (e.g. PA0001)
 *   villa     → PV{id:04d}   (e.g. PV0002)
 *   plot      → PP{id:04d}   (e.g. PP0003)
 *   other     → PRO{id:04d}   (unchanged fallback)
 *
 * Rewrites project_code for ALL existing rows and rebuilds canonical_slug
 * (slug + '-' + lowercase code) so public URLs stay in sync. Old PRA/PRV
 * URLs stop resolving after this runs — the codes are display IDs, and no
 * redirect map is kept (same tradeoff as the original code rollout).
 */
export class UpdateProjectCodeScheme1782800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`project_code\` = CONCAT(
        CASE \`project_type\`
          WHEN 'apartment' THEN 'PA'
          WHEN 'villa' THEN 'PV'
          WHEN 'plot' THEN 'PP'
          ELSE 'PRO'
        END,
        LPAD(\`id\`, 4, '0')
      )
    `);

    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`canonical_slug\` = CONCAT(\`slug\`, '-', LOWER(\`project_code\`))
      WHERE \`project_code\` IS NOT NULL
        AND \`project_code\` != ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`project_code\` = CONCAT(
        CASE \`project_type\`
          WHEN 'apartment' THEN 'PRA'
          WHEN 'villa' THEN 'PRV'
          ELSE 'PRO'
        END,
        LPAD(\`id\`, 4, '0')
      )
    `);

    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`canonical_slug\` = CONCAT(\`slug\`, '-', LOWER(\`project_code\`))
      WHERE \`project_code\` IS NOT NULL
        AND \`project_code\` != ''
    `);
  }
}
