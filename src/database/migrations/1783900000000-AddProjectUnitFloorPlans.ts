import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProjectUnitFloorPlans1783900000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('project_units', 'floor_plans'))) {
      await queryRunner.addColumn('project_units', new TableColumn({ name: 'floor_plans', type: 'json', isNullable: true }));
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('project_units', 'floor_plans')) await queryRunner.dropColumn('project_units', 'floor_plans');
  }
}
