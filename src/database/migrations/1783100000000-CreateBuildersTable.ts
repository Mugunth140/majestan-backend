import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBuildersTable1783100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const tableExists = await queryRunner.hasTable('builders');
    if (!tableExists) {
      await queryRunner.query(`
        CREATE TABLE \`builders\` (
          \`id\` INT UNSIGNED NOT NULL AUTO_INCREMENT,
          \`name\` VARCHAR(255) NOT NULL,
          \`slug\` VARCHAR(255) NOT NULL,
          \`logo_url\` VARCHAR(1024) NULL,
          \`phone\` VARCHAR(30) NULL,
          \`email\` VARCHAR(255) NULL,
          \`website\` VARCHAR(255) NULL,
          \`experience_years\` INT UNSIGNED NULL,
          \`completed_projects\` INT UNSIGNED NULL DEFAULT 0,
          \`ongoing_projects\` INT UNSIGNED NULL DEFAULT 0,
          \`description\` TEXT NULL,
          \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
          \`created_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE KEY \`uq_builders_slug\` (\`slug\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
    }

    const columnExists = await queryRunner.hasColumn('projects', 'builder_id');
    if (!columnExists) {
      await queryRunner.query(`
        ALTER TABLE \`projects\`
        ADD COLUMN \`builder_id\` INT UNSIGNED NULL AFTER \`builder_name\`
      `);
    }

    // Check foreign key constraint existence before adding
    const fks = await queryRunner.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'projects'
        AND CONSTRAINT_NAME = 'fk_projects_builder'
    `);
    if (!fks || fks.length === 0) {
      await queryRunner.query(`
        ALTER TABLE \`projects\`
        ADD CONSTRAINT \`fk_projects_builder\` FOREIGN KEY (\`builder_id\`) REFERENCES \`builders\`(\`id\`) ON DELETE SET NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const fks = await queryRunner.query(`
      SELECT CONSTRAINT_NAME
      FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'projects'
        AND CONSTRAINT_NAME = 'fk_projects_builder'
    `);
    if (fks && fks.length > 0) {
      await queryRunner.query(`
        ALTER TABLE \`projects\`
        DROP FOREIGN KEY \`fk_projects_builder\`
      `);
    }

    const columnExists = await queryRunner.hasColumn('projects', 'builder_id');
    if (columnExists) {
      await queryRunner.query(`
        ALTER TABLE \`projects\`
        DROP COLUMN \`builder_id\`
      `);
    }

    const tableExists = await queryRunner.hasTable('builders');
    if (tableExists) {
      await queryRunner.query(`
        DROP TABLE \`builders\`
      `);
    }
  }
}
