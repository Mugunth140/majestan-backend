import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableIndex,
} from 'typeorm';

type LegacySlugConfig = {
  table: string;
  offset: number;
  codePrefix: string;
  nameColumn: string;
  fallbackLabel: string;
};

const LEGACY_SLUG_CONFIGS: LegacySlugConfig[] = [
  {
    table: 'apartment',
    offset: 100000000,
    codePrefix: 'ap',
    nameColumn: 'propertyname',
    fallbackLabel: 'apartment',
  },
  {
    table: 'villas',
    offset: 200000000,
    codePrefix: 'v',
    nameColumn: 'propertyname',
    fallbackLabel: 'villa',
  },
  {
    table: 'individual_portions',
    offset: 300000000,
    codePrefix: 'ip',
    nameColumn: 'propertyname',
    fallbackLabel: 'independent-house',
  },
  {
    table: 'plots',
    offset: 400000000,
    codePrefix: 'p',
    nameColumn: 'propertyname',
    fallbackLabel: 'plot',
  },
  {
    table: 'farmlands',
    offset: 500000000,
    codePrefix: 'fl',
    nameColumn: 'propertyname',
    fallbackLabel: 'farmland',
  },
  {
    table: 'commercial_space',
    offset: 600000000,
    codePrefix: 'cs',
    nameColumn: 'propertyname',
    fallbackLabel: 'commercial-space',
  },
  {
    table: 'industrial_spaces',
    offset: 700000000,
    codePrefix: 'in',
    nameColumn: 'propertyname',
    fallbackLabel: 'industrial-space',
  },
  {
    table: 'coworkers',
    offset: 800000000,
    codePrefix: 'cw',
    nameColumn: 'propertyname',
    fallbackLabel: 'coworking',
  },
];

export class AddPropertySeoSlugColumns1779200000000 implements MigrationInterface {
  name = 'AddPropertySeoSlugColumns1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const propertiesTable = await queryRunner.getTable('properties');
    if (!propertiesTable) {
      return;
    }

    if (!propertiesTable.findColumnByName('property_code')) {
      await queryRunner.addColumn(
        'properties',
        new TableColumn({
          name: 'property_code',
          type: 'varchar',
          length: '64',
          isNullable: true,
        }),
      );
    }

    if (!propertiesTable.findColumnByName('slug')) {
      await queryRunner.addColumn(
        'properties',
        new TableColumn({
          name: 'slug',
          type: 'varchar',
          length: '512',
          isNullable: true,
        }),
      );
    }

    for (const config of LEGACY_SLUG_CONFIGS) {
      await this.backfillFromLegacy(queryRunner, config);
    }

    await queryRunner.query(`
      UPDATE properties
      SET property_code = LOWER(CONCAT('prop', id))
      WHERE property_code IS NULL OR TRIM(property_code) = ''
    `);

    await queryRunner.query(`
      UPDATE properties
      SET slug = LOWER(
        CONCAT(
          'property-',
          id,
          '-',
          property_code
        )
      )
      WHERE slug IS NULL OR TRIM(slug) = ''
    `);

    const refreshedTable = await queryRunner.getTable('properties');
    if (!refreshedTable) {
      return;
    }

    const propertyCodeIndex = refreshedTable.indices.find(
      (index) => index.name === 'idx_properties_property_code',
    );
    if (!propertyCodeIndex) {
      await queryRunner.createIndex(
        'properties',
        new TableIndex({
          name: 'idx_properties_property_code',
          columnNames: ['property_code'],
          isUnique: true,
        }),
      );
    }

    const slugIndex = refreshedTable.indices.find(
      (index) => index.name === 'idx_properties_slug',
    );
    if (!slugIndex) {
      await queryRunner.createIndex(
        'properties',
        new TableIndex({
          name: 'idx_properties_slug',
          columnNames: ['slug'],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('properties');
    if (!table) {
      return;
    }

    const propertyCodeIndex = table.indices.find(
      (index) => index.name === 'idx_properties_property_code',
    );
    if (propertyCodeIndex) {
      await queryRunner.dropIndex('properties', propertyCodeIndex);
    }

    const slugIndex = table.indices.find(
      (index) => index.name === 'idx_properties_slug',
    );
    if (slugIndex) {
      await queryRunner.dropIndex('properties', slugIndex);
    }

    if (table.findColumnByName('slug')) {
      await queryRunner.dropColumn('properties', 'slug');
    }

    if (table.findColumnByName('property_code')) {
      await queryRunner.dropColumn('properties', 'property_code');
    }
  }

  private async backfillFromLegacy(
    queryRunner: QueryRunner,
    config: LegacySlugConfig,
  ): Promise<void> {
    const legacyTable = await queryRunner.getTable(config.table);
    if (!legacyTable) {
      return;
    }

    const slugBaseExpression = `
      LOWER(
        TRIM(BOTH '-' FROM REGEXP_REPLACE(
          REPLACE(REPLACE(REPLACE(
            COALESCE(
              NULLIF(TRIM(legacy.slug_url), ''),
              NULLIF(TRIM(legacy.${config.nameColumn}), ''),
              CONCAT('${config.fallbackLabel}-', legacy.id)
            ),
            '&',
            ' and '
          ), '/', ' '), '_', ' '),
          '[^a-zA-Z0-9]+',
          '-'
        ))
      )
    `;

    await queryRunner.query(`
      UPDATE properties p
      INNER JOIN (
        SELECT
          id,
          LOWER(CONCAT('${config.codePrefix}', id)) AS generated_property_code,
          ${slugBaseExpression} AS generated_slug_base
        FROM ${config.table} legacy
      ) s ON p.id = ${config.offset} + s.id
      SET
        p.property_code = s.generated_property_code,
        p.slug = CASE
          WHEN s.generated_slug_base = '' THEN s.generated_property_code
          WHEN s.generated_slug_base REGEXP CONCAT('-', s.generated_property_code, '$')
            THEN s.generated_slug_base
          ELSE CONCAT(s.generated_slug_base, '-', s.generated_property_code)
        END
      WHERE p.property_code IS NULL OR p.slug IS NULL
    `);
  }
}
