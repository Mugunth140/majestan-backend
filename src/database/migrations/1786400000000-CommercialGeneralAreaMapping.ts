import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Fill only missing commercial built-up area after explicit owner approval. */
export class CommercialGeneralAreaMapping1786400000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`UPDATE property_details d
      JOIN properties p ON p.id = d.property_id
      SET d.built_up_area = d.area_sqft
      WHERE p.property_type = 'commercial'
        AND (d.built_up_area IS NULL OR d.built_up_area = 0)
        AND d.area_sqft > 0
        AND d.area_unit = 'Sq Ft'`);
  }

  async down(): Promise<void> {
    // Do not erase mapped measurements or subsequent operator corrections.
  }
}
