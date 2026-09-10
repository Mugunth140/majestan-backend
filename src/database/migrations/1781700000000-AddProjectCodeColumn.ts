import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds project_code to the projects table and backfills existing rows.
 * Format: PRA{LPAD(id,4,'0')} for apartment, PRV{LPAD(id,4,'0')} for villa, PRO for any future types.
 */
export class AddProjectCodeColumn1781700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add the column (nullable so existing rows are not violated before backfill)
    await queryRunner.query(`
      ALTER TABLE \`projects\`
        ADD COLUMN \`project_code\` varchar(20) NULL,
        ADD UNIQUE INDEX \`idx_projects_project_code\` (\`project_code\`)
    `);

    // 2. Backfill apartment projects
    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`project_code\` = CONCAT('PRA', LPAD(\`id\`, 4, '0'))
      WHERE \`project_type\` = 'apartment'
    `);

    // 3. Backfill villa projects
    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`project_code\` = CONCAT('PRV', LPAD(\`id\`, 4, '0'))
      WHERE \`project_type\` = 'villa'
    `);

    // 4. Backfill any other types with generic prefix
    await queryRunner.query(`
      UPDATE \`projects\`
      SET \`project_code\` = CONCAT('PRO', LPAD(\`id\`, 4, '0'))
      WHERE \`project_code\` IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`projects\`
        DROP INDEX \`idx_projects_project_code\`,
        DROP COLUMN \`project_code\`
    `);
  }
}
