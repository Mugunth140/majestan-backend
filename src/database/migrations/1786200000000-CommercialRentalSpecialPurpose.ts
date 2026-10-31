import { MigrationInterface, QueryRunner } from 'typeorm';
export class CommercialRentalSpecialPurpose1786200000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasColumn('property_details', 'special_purpose'))) await q.query('ALTER TABLE property_details ADD COLUMN special_purpose VARCHAR(255) NULL');
  }
  async down(): Promise<void> { /* Preserve user-entered classifications. */ }
}
