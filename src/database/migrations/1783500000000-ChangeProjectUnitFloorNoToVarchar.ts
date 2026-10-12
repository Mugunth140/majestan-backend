import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangeProjectUnitFloorNoToVarchar1783500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`project_units\`
      MODIFY COLUMN \`floor_no\` varchar(255) NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`project_units\`
      MODIFY COLUMN \`floor_no\` smallint unsigned NULL;
    `);
  }
}
