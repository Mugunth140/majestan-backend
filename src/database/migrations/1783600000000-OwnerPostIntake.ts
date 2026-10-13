import { MigrationInterface, QueryRunner, Table } from 'typeorm';

export class OwnerPostIntake1783600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'property_drafts',
        columns: [
          { name: 'id', type: 'int', unsigned: true, isPrimary: true, isGenerated: true, generationStrategy: 'increment' },
          { name: 'phone', type: 'varchar', length: '20', isNullable: false, isUnique: true },
          { name: 'payload', type: 'json', isNullable: false },
          { name: 'created_at', type: 'timestamp', precision: 6, default: 'CURRENT_TIMESTAMP(6)' },
          {
            name: 'updated_at',
            type: 'timestamp',
            precision: 6,
            default: 'CURRENT_TIMESTAMP(6)',
            onUpdate: 'CURRENT_TIMESTAMP(6)',
          },
        ],
      }),
      true,
    );
    if (!(await queryRunner.hasColumn('properties', 'source'))) {
      await queryRunner.query(
        "ALTER TABLE `properties` ADD COLUMN `source` varchar(32) NOT NULL DEFAULT 'staff'",
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE `properties` DROP COLUMN `source`');
    await queryRunner.dropTable('property_drafts', true);
  }
}
