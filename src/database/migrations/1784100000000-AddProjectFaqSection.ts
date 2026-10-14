import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProjectFaqSection1784100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Idempotent: the column may already exist where it was added
    // out-of-band. Only environments missing it get the ALTER.
    const rows: Array<{ n: string | number }> = await queryRunner.query(`
      SELECT COUNT(*) AS n
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'project_faqs'
        AND COLUMN_NAME = 'section';
    `);
    if (Number(rows?.[0]?.n ?? 0) === 0) {
      await queryRunner.query(`
        ALTER TABLE \`project_faqs\`
        ADD COLUMN \`section\` varchar(100) NOT NULL DEFAULT 'overview';
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: Array<{ n: string | number }> = await queryRunner.query(`
      SELECT COUNT(*) AS n
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'project_faqs'
        AND COLUMN_NAME = 'section';
    `);
    if (Number(rows?.[0]?.n ?? 0) > 0) {
      await queryRunner.query(`
        ALTER TABLE \`project_faqs\`
        DROP COLUMN \`section\`;
      `);
    }
  }
}
