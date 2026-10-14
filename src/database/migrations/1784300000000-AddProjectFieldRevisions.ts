import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/** Per-field revisions, so staff editing different fields of one project don't block each other. */
export class AddProjectFieldRevisions1784300000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('projects', 'field_revisions'))) {
      await queryRunner.addColumn('projects', new TableColumn({ name: 'field_revisions', type: 'json', isNullable: true }));
    }
  }
  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn('projects', 'field_revisions')) await queryRunner.dropColumn('projects', 'field_revisions');
  }
}
