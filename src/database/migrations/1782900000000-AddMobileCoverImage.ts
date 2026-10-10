import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds a dedicated mobile cover image to projects, so the CRM can collect
 * separate desktop and mobile covers and the site hero can serve each to
 * its breakpoint. Nullable — existing projects keep working on the desktop
 * cover alone (mobile falls back to it).
 */
export class AddMobileCoverImage1782900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: the column may already exist on databases where it was
    // added out-of-band. Guard so the migration still records cleanly.
    const exists = await queryRunner.hasColumn('projects', 'mobile_cover_image_url');
    if (!exists) {
      await queryRunner.query(`
        ALTER TABLE \`projects\`
          ADD COLUMN \`mobile_cover_image_url\` varchar(1024) NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`projects\`
        DROP COLUMN \`mobile_cover_image_url\`
    `);
  }
}
