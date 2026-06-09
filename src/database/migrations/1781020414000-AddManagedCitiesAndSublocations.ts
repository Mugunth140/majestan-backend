import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManagedCitiesAndSublocations1781020414000
  implements MigrationInterface
{
  name = 'AddManagedCitiesAndSublocations1781020414000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.createCitiesTable(queryRunner);
    await this.upgradeSublocationsTable(queryRunner);
    await this.createPropertyLocationsTable(queryRunner);
    await this.addCityUniqueIndex(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
    await queryRunner.query('DROP TABLE IF EXISTS `property_locations`');
    await queryRunner.query('DROP TABLE IF EXISTS `sublocations`');
    await queryRunner.query('DROP TABLE IF EXISTS `cities`');
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  private async createCitiesTable(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`cities\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`country_code\` char(2) NOT NULL DEFAULT 'IN',
        \`country_name\` varchar(100) NOT NULL DEFAULT 'India',
        \`state_name\` varchar(50) NOT NULL,
        \`city_name\` varchar(50) NOT NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`idx_cities_is_active\` (\`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async upgradeSublocationsTable(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const hasSublocations = await queryRunner.hasTable('sublocations');
    const hasLegacyName =
      hasSublocations &&
      (await queryRunner.hasColumn('sublocations', 'sublocation'));

    if (hasLegacyName) {
      await queryRunner.query(`
        INSERT INTO \`cities\` (
          \`country_code\`,
          \`country_name\`,
          \`state_name\`,
          \`city_name\`,
          \`is_active\`
        )
        SELECT 'IN', 'India', 'Tamil Nadu', 'Coimbatore', 1
        WHERE NOT EXISTS (
          SELECT 1
          FROM \`cities\`
          WHERE LOWER(\`city_name\`) = 'coimbatore'
            AND LOWER(\`state_name\`) = 'tamil nadu'
        )
      `);

      await queryRunner.query(
        'DROP TABLE IF EXISTS `sublocations_legacy_before_city_mapping`',
      );
      await queryRunner.query(
        'RENAME TABLE `sublocations` TO `sublocations_legacy_before_city_mapping`',
      );
    }

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`sublocations\` (
        \`id\` int unsigned NOT NULL AUTO_INCREMENT,
        \`city_id\` int unsigned NOT NULL,
        \`locality_name\` varchar(100) NOT NULL,
        \`postal_code\` varchar(20) NULL,
        \`latitude\` decimal(10,7) NULL,
        \`longitude\` decimal(10,7) NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_sublocations_city_locality\` (\`city_id\`, \`locality_name\`),
        KEY \`idx_sublocations_is_active\` (\`is_active\`),
        CONSTRAINT \`fk_sublocations_city\`
          FOREIGN KEY (\`city_id\`) REFERENCES \`cities\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    if (hasLegacyName) {
      await queryRunner.query(`
        INSERT IGNORE INTO \`sublocations\` (
          \`city_id\`,
          \`locality_name\`,
          \`is_active\`,
          \`created_at\`,
          \`updated_at\`
        )
        SELECT
          (
            SELECT \`id\`
            FROM \`cities\`
            WHERE LOWER(\`city_name\`) = 'coimbatore'
              AND LOWER(\`state_name\`) = 'tamil nadu'
            ORDER BY \`id\`
            LIMIT 1
          ),
          TRIM(\`sublocation\`),
          MAX(CASE WHEN \`status\` = 1 THEN 1 ELSE 0 END),
          COALESCE(MIN(\`created_at\`), NOW(6)),
          COALESCE(MAX(\`updated_at\`), NOW(6))
        FROM \`sublocations_legacy_before_city_mapping\`
        WHERE COALESCE(TRIM(\`sublocation\`), '') <> ''
        GROUP BY LOWER(TRIM(\`sublocation\`)), TRIM(\`sublocation\`)
      `);

      await queryRunner.query(
        'DROP TABLE `sublocations_legacy_before_city_mapping`',
      );
    }
  }

  private async createPropertyLocationsTable(
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (await queryRunner.hasTable('property_locations')) {
      return;
    }

    const propertiesTable = await queryRunner.getTable('properties');
    const propertyIdColumn = propertiesTable?.findColumnByName('id');
    const propertyIdType =
      propertyIdColumn?.type === 'bigint' ? 'bigint unsigned' : 'int unsigned';

    await queryRunner.query(`
      CREATE TABLE \`property_locations\` (
        \`property_id\` ${propertyIdType} NOT NULL,
        \`location_id\` int unsigned NOT NULL,
        \`landmark\` varchar(255) NULL,
        \`latitude\` decimal(10,7) NULL,
        \`longitude\` decimal(10,7) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`property_id\`, \`location_id\`),
        KEY \`idx_property_locations_location\` (\`location_id\`),
        CONSTRAINT \`fk_property_locations_property\`
          FOREIGN KEY (\`property_id\`) REFERENCES \`properties\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_property_locations_sublocation\`
          FOREIGN KEY (\`location_id\`) REFERENCES \`sublocations\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async addCityUniqueIndex(queryRunner: QueryRunner): Promise<void> {
    const cityTable = await queryRunner.getTable('cities');
    const hasUniqueIndex = cityTable?.indices.some(
      (index) => index.name === 'uq_cities_name_state_country',
    );

    if (!hasUniqueIndex) {
      await queryRunner.query(`
        ALTER TABLE \`cities\`
        ADD UNIQUE KEY \`uq_cities_name_state_country\`
          (\`city_name\`, \`state_name\`, \`country_code\`)
      `);
    }
  }
}
