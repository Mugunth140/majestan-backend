import { MigrationInterface, QueryRunner } from 'typeorm';

export class UpdatePropertySeoSlugs1779300000000 implements MigrationInterface {
  name = 'UpdatePropertySeoSlugs1779300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE properties
      SET slug = LOWER(
        CONCAT(
          TRIM(BOTH '-' FROM REGEXP_REPLACE(
            REPLACE(REPLACE(REPLACE(
              title,
              '&',
              ' and '
            ), '/', ' '), '_', ' '),
            '[^a-zA-Z0-9]+',
            '-'
          )),
          '-',
          CASE LOWER(property_type)
            WHEN 'apartment' THEN 'ap'
            WHEN 'villa' THEN 'vl'
            WHEN 'plot' THEN 'pl'
            WHEN 'commercial' THEN 'cm'
            WHEN 'coworking' THEN 'cw'
            WHEN 'farmland' THEN 'fm'
            WHEN 'industrial' THEN 'in'
            WHEN 'individual_portion' THEN 'ip'
            ELSE 'ot'
          END,
          id
        )
      )
      WHERE id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverting slugs to previous format is non-trivial without a backup,
    // so we leave it empty or log a warning.
  }
}
