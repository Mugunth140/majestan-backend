import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProjectRevision1783800000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('projects', 'revision'))) {
      await queryRunner.addColumn('projects', new TableColumn({ name: 'revision', type: 'int', unsigned: true, default: '1', isNullable: false }));
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('projects', 'revision')) await queryRunner.dropColumn('projects', 'revision');
  }
}
