import { MigrationInterface, QueryRunner } from 'typeorm';
export class PropertyCurationTwo1786300000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasColumn('properties', 'contact_details')))
      await q.query(
        'ALTER TABLE properties ADD COLUMN contact_details JSON NULL',
      );
    if (!(await q.hasColumn('property_details', 'curation_details')))
      await q.query(
        'ALTER TABLE property_details ADD COLUMN curation_details JSON NULL',
      );
  }
  async down(): Promise<void> {
    /* Preserve existing and newly entered property data. */
  }
}
