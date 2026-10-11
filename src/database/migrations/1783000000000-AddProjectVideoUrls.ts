import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds YouTube video links to projects (gallery videos). Stored as a JSON
 * string array so the site photos page can render them later. Nullable —
 * existing projects are unaffected.
 */
export class AddProjectVideoUrls1783000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const exists = await queryRunner.hasColumn('projects', 'video_urls');
    if (!exists) {
      await queryRunner.query(`
        ALTER TABLE \`projects\`
          ADD COLUMN \`video_urls\` json NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`projects\`
        DROP COLUMN \`video_urls\`
    `);
  }
}
