import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Utilities master (staff-curated, e.g. Water / Electricity with a picked
 * icon) for the utilities-provided property dropdown.
 */
export class CreateUtilities1782400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`utilities\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(120) NOT NULL,
        \`slug\` varchar(140) NOT NULL,
        \`icon\` varchar(100) NULL,
        \`is_active\` tinyint(1) NOT NULL DEFAULT 1,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_utilities_slug\` (\`slug\`),
        UNIQUE KEY \`uq_utilities_name\` (\`name\`),
        KEY \`idx_utilities_is_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `utilities`');
  }
}
