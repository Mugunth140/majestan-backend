import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPropertyPricePerSqft1785900000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    if (!(await q.hasColumn('properties', 'price_per_sqft'))) {
      await q.query('ALTER TABLE properties ADD COLUMN price_per_sqft DECIMAL(15,2) NULL AFTER expected_sale_price');
    }
  }

  async down(): Promise<void> {
    // Preserve separately entered rates on rollback.
  }
}
