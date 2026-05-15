import { MigrationInterface, QueryRunner } from 'typeorm';

export class RefactorLegacyToUnifiedSchema1779100000000 implements MigrationInterface {
  name = 'RefactorLegacyToUnifiedSchema1779100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await this.renameLegacyBlogsTable(queryRunner);
    await this.createTargetTables(queryRunner);
    await this.migrateUsers(queryRunner);
    await this.migrateProperties(queryRunner);
    await this.ensureFallbackProperty(queryRunner);
    await this.migratePropertyDetails(queryRunner);
    await this.migratePropertyImages(queryRunner);
    await this.migratePropertyUnits(queryRunner);
    await this.migrateAmenities(queryRunner);
    await this.migrateLeads(queryRunner);
    await this.migrateWishlists(queryRunner);
    await this.migrateBlogs(queryRunner);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

    await queryRunner.query('DROP TABLE IF EXISTS `blog_tags`');
    await queryRunner.query('DROP TABLE IF EXISTS `tags`');
    await queryRunner.query('DROP TABLE IF EXISTS `blogs`');
    await queryRunner.query('DROP TABLE IF EXISTS `wishlists`');
    await queryRunner.query('DROP TABLE IF EXISTS `leads`');
    await queryRunner.query('DROP TABLE IF EXISTS `property_amenities`');
    await queryRunner.query('DROP TABLE IF EXISTS `amenities`');
    await queryRunner.query('DROP TABLE IF EXISTS `property_units`');
    await queryRunner.query('DROP TABLE IF EXISTS `property_images`');
    await queryRunner.query('DROP TABLE IF EXISTS `property_details`');
    await queryRunner.query('DROP TABLE IF EXISTS `properties`');
    await queryRunner.query('DROP TABLE IF EXISTS `users`');

    const hasLegacyBlogs = await queryRunner.hasTable('legacy_blogs');
    const hasBlogs = await queryRunner.hasTable('blogs');
    if (hasLegacyBlogs && !hasBlogs) {
      await queryRunner.query('RENAME TABLE `legacy_blogs` TO `blogs`');
    }

    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
  }

  private async renameLegacyBlogsTable(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const hasBlogs = await queryRunner.hasTable('blogs');
    const hasLegacyBlogs = await queryRunner.hasTable('legacy_blogs');
    const blogsHasAuthorId = hasBlogs
      ? await this.safeHasColumn(queryRunner, 'blogs', 'author_id')
      : false;

    if (hasBlogs && !hasLegacyBlogs && !blogsHasAuthorId) {
      await queryRunner.query('RENAME TABLE `blogs` TO `legacy_blogs`');
    }
  }

  private async createTargetTables(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`phone\` varchar(50) NOT NULL DEFAULT '',
        \`password_hash\` varchar(255) NOT NULL DEFAULT '',
        \`role\` enum('admin','agent','user') NOT NULL DEFAULT 'user',
        \`is_verified\` tinyint(1) NOT NULL DEFAULT 0,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_users_email\` (\`email\`),
        KEY \`idx_users_role\` (\`role\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`properties\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`title\` varchar(255) NOT NULL,
        \`description\` text NULL,
        \`price\` decimal(12,2) NULL,
        \`property_type\` enum('apartment','villa','individual_portion','plot','farmland','commercial','industrial','coworking','other') NOT NULL DEFAULT 'other',
        \`status\` enum('available','sold','rented') NOT NULL DEFAULT 'available',
        \`owner_id\` bigint unsigned NOT NULL,
        \`city\` varchar(150) NOT NULL DEFAULT 'Unknown',
        \`state\` varchar(150) NOT NULL DEFAULT 'Unknown',
        \`country\` varchar(150) NOT NULL DEFAULT 'India',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_properties_owner_id\` (\`owner_id\`),
        KEY \`idx_properties_type_status\` (\`property_type\`, \`status\`),
        KEY \`idx_properties_city\` (\`city\`),
        KEY \`idx_properties_price\` (\`price\`),
        CONSTRAINT \`fk_properties_owner\` FOREIGN KEY (\`owner_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`property_details\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`property_id\` bigint unsigned NOT NULL,
        \`bedrooms\` int NULL,
        \`bathrooms\` int NULL,
        \`area_sqft\` decimal(12,2) NULL,
        \`parking\` int NULL,
        \`furnished\` tinyint(1) NOT NULL DEFAULT 0,
        \`extra_json\` json NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_property_details_property\` (\`property_id\`),
        CONSTRAINT \`fk_property_details_property\` FOREIGN KEY (\`property_id\`) REFERENCES \`properties\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`property_images\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`property_id\` bigint unsigned NOT NULL,
        \`image_url\` varchar(1024) NOT NULL,
        \`image_key\` varchar(1024) NOT NULL,
        \`is_primary\` tinyint(1) NOT NULL DEFAULT 0,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_property_images_property_key\` (\`property_id\`, \`image_key\`(191)),
        KEY \`idx_property_images_property\` (\`property_id\`),
        CONSTRAINT \`fk_property_images_property\` FOREIGN KEY (\`property_id\`) REFERENCES \`properties\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`property_units\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`property_id\` bigint unsigned NOT NULL,
        \`unit_code\` varchar(100) NOT NULL,
        \`unit_type\` enum('apartment','villa','individual_portion','plot','farmland','commercial','industrial','coworking','other') NOT NULL DEFAULT 'other',
        \`bedrooms\` int NULL,
        \`bathrooms\` int NULL,
        \`area_sqft\` decimal(12,2) NULL,
        \`price\` decimal(12,2) NULL,
        \`monthly_rent\` decimal(12,2) NULL,
        \`furnished\` tinyint(1) NOT NULL DEFAULT 0,
        \`status\` enum('available','sold','rented') NOT NULL DEFAULT 'available',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_property_units_code\` (\`property_id\`, \`unit_code\`),
        KEY \`idx_property_units_property\` (\`property_id\`),
        KEY \`idx_property_units_type\` (\`unit_type\`),
        CONSTRAINT \`fk_property_units_property\` FOREIGN KEY (\`property_id\`) REFERENCES \`properties\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`amenities\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(120) NOT NULL,
        \`slug\` varchar(160) NOT NULL,
        \`category\` enum('feature','utility','security','connectivity','other') NOT NULL DEFAULT 'other',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_amenities_slug\` (\`slug\`),
        UNIQUE KEY \`uq_amenities_name\` (\`name\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`property_amenities\` (
        \`property_id\` bigint unsigned NOT NULL,
        \`amenity_id\` bigint unsigned NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`property_id\`, \`amenity_id\`),
        KEY \`idx_property_amenities_amenity\` (\`amenity_id\`),
        CONSTRAINT \`fk_property_amenities_property\` FOREIGN KEY (\`property_id\`) REFERENCES \`properties\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT \`fk_property_amenities_amenity\` FOREIGN KEY (\`amenity_id\`) REFERENCES \`amenities\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`leads\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`property_id\` bigint unsigned NOT NULL,
        \`user_id\` bigint unsigned NULL,
        \`name\` varchar(255) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`phone\` varchar(50) NOT NULL DEFAULT '',
        \`message\` text NULL,
        \`status\` enum('new','contacted','closed') NOT NULL DEFAULT 'new',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_leads_property\` (\`property_id\`),
        KEY \`idx_leads_user\` (\`user_id\`),
        KEY \`idx_leads_status\` (\`status\`),
        CONSTRAINT \`fk_leads_property\` FOREIGN KEY (\`property_id\`) REFERENCES \`properties\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT,
        CONSTRAINT \`fk_leads_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE CASCADE ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`wishlists\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`user_id\` bigint unsigned NOT NULL,
        \`property_id\` bigint unsigned NOT NULL,
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_wishlists_user_property\` (\`user_id\`, \`property_id\`),
        KEY \`idx_wishlists_property\` (\`property_id\`),
        CONSTRAINT \`fk_wishlists_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT \`fk_wishlists_property\` FOREIGN KEY (\`property_id\`) REFERENCES \`properties\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`blogs\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`title\` varchar(255) NOT NULL,
        \`slug\` varchar(255) NOT NULL,
        \`content\` longtext NULL,
        \`author_id\` bigint unsigned NOT NULL,
        \`status\` enum('draft','published') NOT NULL DEFAULT 'draft',
        \`created_at\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_blogs_slug\` (\`slug\`),
        KEY \`idx_blogs_author\` (\`author_id\`),
        KEY \`idx_blogs_status\` (\`status\`),
        CONSTRAINT \`fk_blogs_author\` FOREIGN KEY (\`author_id\`) REFERENCES \`users\` (\`id\`) ON UPDATE CASCADE ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tags\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`name\` varchar(100) NOT NULL,
        \`slug\` varchar(120) NOT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_tags_name\` (\`name\`),
        UNIQUE KEY \`uq_tags_slug\` (\`slug\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`blog_tags\` (
        \`blog_id\` bigint unsigned NOT NULL,
        \`tag_id\` bigint unsigned NOT NULL,
        PRIMARY KEY (\`blog_id\`, \`tag_id\`),
        KEY \`idx_blog_tags_tag\` (\`tag_id\`),
        CONSTRAINT \`fk_blog_tags_blog\` FOREIGN KEY (\`blog_id\`) REFERENCES \`blogs\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT \`fk_blog_tags_tag\` FOREIGN KEY (\`tag_id\`) REFERENCES \`tags\` (\`id\`) ON UPDATE CASCADE ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  }

  private async migrateUsers(queryRunner: QueryRunner): Promise<void> {
    const hasLegacyUser = await queryRunner.hasTable('user');
    if (hasLegacyUser) {
      await queryRunner.query(`
        INSERT IGNORE INTO \`users\` (
          \`id\`, \`name\`, \`email\`, \`phone\`, \`password_hash\`, \`role\`, \`is_verified\`, \`created_at\`, \`updated_at\`
        )
        SELECT
          CAST(\`id\` AS UNSIGNED),
          COALESCE(NULLIF(TRIM(COALESCE(\`first_name\`, \`username\`)), ''), CONCAT('Legacy User #', \`id\`)),
          COALESCE(NULLIF(TRIM(\`contact_email\`), ''), CONCAT('legacy-user-', \`id\`, '@majestan.local')),
          COALESCE(NULLIF(TRIM(\`contact_number\`), ''), ''),
          COALESCE(\`password\`, ''),
          CASE
            WHEN LOWER(COALESCE(\`status\`, '1')) IN ('1', 'active', 'admin') THEN 'admin'
            ELSE 'agent'
          END,
          1,
          COALESCE(\`created_at\`, NOW()),
          COALESCE(\`created_at\`, NOW())
        FROM \`user\`
      `);
    }

    const hasLogin = await queryRunner.hasTable('login');
    if (hasLogin) {
      await queryRunner.query(`
        INSERT IGNORE INTO \`users\` (
          \`name\`, \`email\`, \`phone\`, \`password_hash\`, \`role\`, \`is_verified\`, \`created_at\`, \`updated_at\`
        )
        SELECT
          COALESCE(NULLIF(TRIM(\`username\`), ''), CONCAT('Legacy Login #', \`id\`)),
          CONCAT('legacy-login-', \`id\`, '@majestan.local'),
          '',
          COALESCE(\`password\`, ''),
          CASE
            WHEN LOWER(COALESCE(\`role\`, 'user')) = 'admin' THEN 'admin'
            WHEN LOWER(COALESCE(\`role\`, 'user')) = 'agent' THEN 'agent'
            ELSE 'user'
          END,
          1,
          COALESCE(\`created_at\`, NOW()),
          COALESCE(\`updated_at\`, \`created_at\`, NOW())
        FROM \`login\`
      `);
    }

    const hasWishlist = await queryRunner.hasTable('wishlist');
    if (hasWishlist) {
      await queryRunner.query(`
        INSERT IGNORE INTO \`users\` (
          \`name\`, \`email\`, \`phone\`, \`password_hash\`, \`role\`, \`is_verified\`, \`created_at\`, \`updated_at\`
        )
        SELECT DISTINCT
          CONCAT('Legacy Wishlist ', TRIM(\`user_id\`)),
          CONCAT(
            'legacy-wishlist-',
            LOWER(REPLACE(REPLACE(REPLACE(TRIM(\`user_id\`), ' ', '-'), '@', '-'), '.', '-')),
            '@majestan.local'
          ),
          '',
          '',
          'user',
          1,
          COALESCE(\`created_at\`, NOW()),
          COALESCE(\`updated_at\`, \`created_at\`, NOW())
        FROM \`wishlist\`
        WHERE COALESCE(TRIM(\`user_id\`), '') <> ''
          AND CAST(TRIM(\`user_id\`) AS UNSIGNED) = 0
      `);
    }

    await queryRunner.query(`
      INSERT IGNORE INTO \`users\` (
        \`id\`, \`name\`, \`email\`, \`phone\`, \`password_hash\`, \`role\`, \`is_verified\`, \`created_at\`, \`updated_at\`
      ) VALUES (
        1, 'System', 'system@majestan.local', '', '', 'admin', 1, NOW(), NOW()
      )
    `);
  }

  private async migrateProperties(queryRunner: QueryRunner): Promise<void> {
    const inserts: Array<{
      table: string;
      offset: number;
      type: string;
      titleExpr: string;
      descriptionExpr: string;
      priceExpr: string;
      cityExpr: string;
      statusExpr: string;
      ownerExpr: string;
      createdAtExpr: string;
      updatedAtExpr: string;
    }> = [
      {
        table: 'apartment',
        offset: 100000000,
        type: 'apartment',
        titleExpr:
          "COALESCE(NULLIF(TRIM(`propertyname`), ''), CONCAT('Apartment #', `id`))",
        descriptionExpr:
          "COALESCE(NULLIF(TRIM(`remark`), ''), NULLIF(TRIM(`key_highlight`), ''), NULLIF(TRIM(`address`), ''), '')",
        priceExpr:
          'COALESCE(' +
          `${this.money('`expectedsaleprice`')}, ${this.money('`price`')}, ${this.money('`monthly_rent`')}` +
          ')',
        cityExpr: "COALESCE(NULLIF(TRIM(`sublocation`), ''), 'Unknown')",
        statusExpr: this.statusCase('`status`'),
        ownerExpr:
          "COALESCE((SELECT `u`.`id` FROM `users` `u` WHERE `u`.`id` = CAST(NULLIF(TRIM(`created_by`), '') AS UNSIGNED) LIMIT 1), 1)",
        createdAtExpr: 'COALESCE(`created_at`, NOW())',
        updatedAtExpr: 'COALESCE(`updated_at`, `created_at`, NOW())',
      },
      {
        table: 'villas',
        offset: 200000000,
        type: 'villa',
        titleExpr:
          "COALESCE(NULLIF(TRIM(`propertyname`), ''), CONCAT('Villa #', `id`))",
        descriptionExpr:
          "COALESCE(NULLIF(TRIM(`remark`), ''), NULLIF(TRIM(`key_highlight`), ''), NULLIF(TRIM(`address`), ''), '')",
        priceExpr:
          'COALESCE(' +
          `${this.money('`expectedsaleprice`')}, ${this.money('`price`')}, ${this.money('`monthly_rent`')}` +
          ')',
        cityExpr: "COALESCE(NULLIF(TRIM(`sublocation`), ''), 'Unknown')",
        statusExpr: this.statusCase('`status`'),
        ownerExpr: '1',
        createdAtExpr: 'COALESCE(`created_at`, NOW())',
        updatedAtExpr: 'COALESCE(`updated_at`, `created_at`, NOW())',
      },
      {
        table: 'individual_portions',
        offset: 300000000,
        type: 'individual_portion',
        titleExpr:
          "COALESCE(NULLIF(TRIM(`propertyname`), ''), CONCAT('Individual Portion #', `id`))",
        descriptionExpr:
          "COALESCE(NULLIF(TRIM(`remark`), ''), NULLIF(TRIM(`key_highlight`), ''), NULLIF(TRIM(`address`), ''), '')",
        priceExpr:
          'COALESCE(' +
          `${this.money('`expectedsaleprice`')}, ${this.money('`price`')}, ${this.money('`monthly_rent`')}` +
          ')',
        cityExpr: "COALESCE(NULLIF(TRIM(`sublocation`), ''), 'Unknown')",
        statusExpr: this.statusCase('`status`'),
        ownerExpr: '1',
        createdAtExpr: 'COALESCE(`created_at`, NOW())',
        updatedAtExpr: 'COALESCE(`updated_at`, `created_at`, NOW())',
      },
      {
        table: 'plots',
        offset: 400000000,
        type: 'plot',
        titleExpr:
          "COALESCE(NULLIF(TRIM(`propertyname`), ''), CONCAT('Plot #', `id`))",
        descriptionExpr:
          "COALESCE(NULLIF(TRIM(`remark`), ''), NULLIF(TRIM(`key_highlight`), ''), NULLIF(TRIM(`address`), ''), '')",
        priceExpr:
          'COALESCE(' +
          `${this.money('`expectedsaleprice`')}, ${this.money('`price`')}, ${this.money('`monthly_rent`')}` +
          ')',
        cityExpr: "COALESCE(NULLIF(TRIM(`sublocation`), ''), 'Unknown')",
        statusExpr: this.statusCase('`status`'),
        ownerExpr: '1',
        createdAtExpr: 'COALESCE(`created_at`, NOW())',
        updatedAtExpr: 'COALESCE(`updated_at`, `created_at`, NOW())',
      },
      {
        table: 'farmlands',
        offset: 500000000,
        type: 'farmland',
        titleExpr:
          "COALESCE(NULLIF(TRIM(`propertyname`), ''), CONCAT('Farmland #', `id`))",
        descriptionExpr:
          "COALESCE(NULLIF(TRIM(`remark`), ''), NULLIF(TRIM(`key_highlight`), ''), NULLIF(TRIM(`address`), ''), '')",
        priceExpr:
          'COALESCE(' +
          `${this.money('`expectedsaleprice`')}, ${this.money('`price`')}` +
          ')',
        cityExpr: "COALESCE(NULLIF(TRIM(`sublocation`), ''), 'Unknown')",
        statusExpr: this.statusCase('`status`'),
        ownerExpr: '1',
        createdAtExpr: 'COALESCE(`created_at`, NOW())',
        updatedAtExpr: 'COALESCE(`updated_at`, `created_at`, NOW())',
      },
      {
        table: 'commercial_space',
        offset: 600000000,
        type: 'commercial',
        titleExpr:
          "COALESCE(NULLIF(TRIM(`propertyname`), ''), CONCAT('Commercial Space #', `id`))",
        descriptionExpr:
          "COALESCE(NULLIF(TRIM(`remark`), ''), NULLIF(TRIM(`key_highlight`), ''), NULLIF(TRIM(`address`), ''), '')",
        priceExpr:
          'COALESCE(' +
          `${this.money('`expectedsaleprice`')}, ${this.money('`price`')}, ${this.money('`monthly_rent`')}` +
          ')',
        cityExpr: "COALESCE(NULLIF(TRIM(`sublocation`), ''), 'Unknown')",
        statusExpr: this.statusCase('`status`'),
        ownerExpr:
          "COALESCE((SELECT `u`.`id` FROM `users` `u` WHERE `u`.`id` = CAST(NULLIF(TRIM(`created_by`), '') AS UNSIGNED) LIMIT 1), 1)",
        createdAtExpr: 'COALESCE(`created_at`, NOW())',
        updatedAtExpr: 'COALESCE(`updated_at`, `created_at`, NOW())',
      },
      {
        table: 'industrial_spaces',
        offset: 700000000,
        type: 'industrial',
        titleExpr:
          "COALESCE(NULLIF(TRIM(`propertyname`), ''), CONCAT('Industrial Space #', `id`))",
        descriptionExpr:
          "COALESCE(NULLIF(TRIM(`remark`), ''), NULLIF(TRIM(`key_highlight`), ''), NULLIF(TRIM(`address`), ''), '')",
        priceExpr:
          'COALESCE(' +
          `${this.money('`expectedsaleprice`')}, ${this.money('`price`')}, ${this.money('`monthly_rent`')}` +
          ')',
        cityExpr: "COALESCE(NULLIF(TRIM(`sublocation`), ''), 'Unknown')",
        statusExpr: this.statusCase('`status`'),
        ownerExpr: '1',
        createdAtExpr: 'COALESCE(`created_at`, NOW())',
        updatedAtExpr: 'COALESCE(`updated_at`, `created_at`, NOW())',
      },
      {
        table: 'coworkers',
        offset: 800000000,
        type: 'coworking',
        titleExpr:
          "COALESCE(NULLIF(TRIM(`propertyname`), ''), CONCAT('Coworking Space #', `id`))",
        descriptionExpr:
          "COALESCE(NULLIF(TRIM(`remark`), ''), NULLIF(TRIM(`address`), ''), '')",
        priceExpr:
          'COALESCE(' +
          `${this.money('`expected_rent_perseat`')}, ${this.money('`monthly_rent`')}` +
          ')',
        cityExpr: "COALESCE(NULLIF(TRIM(`sublocation`), ''), 'Unknown')",
        statusExpr: this.statusCase('`status`'),
        ownerExpr: '1',
        createdAtExpr: 'COALESCE(`created_at`, NOW())',
        updatedAtExpr: 'COALESCE(`updated_at`, `created_at`, NOW())',
      },
    ];

    for (const definition of inserts) {
      const exists = await queryRunner.hasTable(definition.table);
      if (!exists) {
        continue;
      }

      await queryRunner.query(`
        INSERT IGNORE INTO \`properties\` (
          \`id\`, \`title\`, \`description\`, \`price\`, \`property_type\`, \`status\`,
          \`owner_id\`, \`city\`, \`state\`, \`country\`, \`created_at\`, \`updated_at\`
        )
        SELECT
          (${definition.offset} + CAST(\`id\` AS UNSIGNED)) AS \`id\`,
          ${definition.titleExpr} AS \`title\`,
          ${definition.descriptionExpr} AS \`description\`,
          ${definition.priceExpr} AS \`price\`,
          '${definition.type}' AS \`property_type\`,
          ${definition.statusExpr} AS \`status\`,
          ${definition.ownerExpr} AS \`owner_id\`,
          ${definition.cityExpr} AS \`city\`,
          'Unknown' AS \`state\`,
          'India' AS \`country\`,
          ${definition.createdAtExpr} AS \`created_at\`,
          ${definition.updatedAtExpr} AS \`updated_at\`
        FROM \`${definition.table}\`
      `);
    }
  }

  private async ensureFallbackProperty(
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.query(`
      INSERT IGNORE INTO \`properties\` (
        \`id\`, \`title\`, \`description\`, \`price\`, \`property_type\`, \`status\`,
        \`owner_id\`, \`city\`, \`state\`, \`country\`, \`created_at\`, \`updated_at\`
      ) VALUES (
        999,
        'Legacy Unmapped Property',
        'Fallback property for unmapped legacy references',
        NULL,
        'other',
        'available',
        1,
        'Unknown',
        'Unknown',
        'India',
        NOW(),
        NOW()
      )
    `);
  }

  private async migratePropertyDetails(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const statements: Array<{ table: string; sql: string }> = [
      {
        table: 'apartment',
        sql: `
          INSERT IGNORE INTO \`property_details\` (
            \`property_id\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`parking\`, \`furnished\`, \`extra_json\`
          )
          SELECT
            (100000000 + CAST(\`id\` AS UNSIGNED)),
            CAST(NULLIF(SUBSTRING_INDEX(\`unittype\`, 'BHK', 1), '') AS UNSIGNED),
            NULL,
            COALESCE(${this.money('`carpet_area`')}, ${this.money('`build_up_area`')}, ${this.money('`super_build_up_area`')}),
            CAST(NULLIF(TRIM(\`parking1\`), '') AS UNSIGNED),
            ${this.furnishedCase('`furnishing_status`')},
            JSON_OBJECT(
              'legacy_table', 'apartment',
              'legacy_id', \`id\`,
              'property_age', \`property_age\`,
              'facing', \`facing\`,
              'amenities_text', \`amenities\`
            )
          FROM \`apartment\`
        `,
      },
      {
        table: 'villas',
        sql: `
          INSERT IGNORE INTO \`property_details\` (
            \`property_id\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`parking\`, \`furnished\`, \`extra_json\`
          )
          SELECT
            (200000000 + CAST(\`id\` AS UNSIGNED)),
            CAST(NULLIF(SUBSTRING_INDEX(\`configuration\`, 'BHK', 1), '') AS UNSIGNED),
            CAST(NULLIF(TRIM(\`bathroom_nos\`), '') AS UNSIGNED),
            COALESCE(${this.money('`buildup_area`')}, ${this.money('`villa_area`')}, ${this.money('`plot_area`')}),
            CAST(NULLIF(TRIM(\`vehicleparking_nos\`), '') AS UNSIGNED),
            ${this.furnishedCase('`furnishing_status`')},
            JSON_OBJECT(
              'legacy_table', 'villas',
              'legacy_id', \`id\`,
              'property_age', \`property_age\`,
              'facing', \`facing_direction\`,
              'amenities_text', \`amentities\`
            )
          FROM \`villas\`
        `,
      },
      {
        table: 'individual_portions',
        sql: `
          INSERT IGNORE INTO \`property_details\` (
            \`property_id\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`parking\`, \`furnished\`, \`extra_json\`
          )
          SELECT
            (300000000 + CAST(\`id\` AS UNSIGNED)),
            CAST(NULLIF(SUBSTRING_INDEX(\`configuration\`, 'BHK', 1), '') AS UNSIGNED),
            CAST(NULLIF(TRIM(\`bathroom_nos\`), '') AS UNSIGNED),
            COALESCE(${this.money('`buildup_area`')}, ${this.money('`plot_area`')}),
            CAST(NULLIF(TRIM(\`parking\`), '') AS UNSIGNED),
            ${this.furnishedCase('`furnishing_status`')},
            JSON_OBJECT(
              'legacy_table', 'individual_portions',
              'legacy_id', \`id\`,
              'property_age', \`property_age\`,
              'facing', \`facing\`,
              'utilities_provided', \`utilities_provided\`
            )
          FROM \`individual_portions\`
        `,
      },
      {
        table: 'plots',
        sql: `
          INSERT IGNORE INTO \`property_details\` (
            \`property_id\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`parking\`, \`furnished\`, \`extra_json\`
          )
          SELECT
            (400000000 + CAST(\`id\` AS UNSIGNED)),
            NULL,
            NULL,
            COALESCE(${this.money('`total_area`')}, ${this.money('`project_area`')}),
            NULL,
            0,
            JSON_OBJECT(
              'legacy_table', 'plots',
              'legacy_id', \`id\`,
              'facing', \`facing_direction\`,
              'plot_type', \`plot_type\`,
              'zoning_usage', \`zoning_usage\`
            )
          FROM \`plots\`
        `,
      },
      {
        table: 'farmlands',
        sql: `
          INSERT IGNORE INTO \`property_details\` (
            \`property_id\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`parking\`, \`furnished\`, \`extra_json\`
          )
          SELECT
            (500000000 + CAST(\`id\` AS UNSIGNED)),
            NULL,
            NULL,
            ${this.money('`totalarea`')},
            NULL,
            0,
            JSON_OBJECT(
              'legacy_table', 'farmlands',
              'legacy_id', \`id\`,
              'land_type', \`landtype\`,
              'soil_type', \`soiltype\`,
              'irrigation', \`irrigationfacilities\`
            )
          FROM \`farmlands\`
        `,
      },
      {
        table: 'commercial_space',
        sql: `
          INSERT IGNORE INTO \`property_details\` (
            \`property_id\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`parking\`, \`furnished\`, \`extra_json\`
          )
          SELECT
            (600000000 + CAST(\`id\` AS UNSIGNED)),
            NULL,
            NULL,
            COALESCE(${this.money('`carpet_area`')}, ${this.money('`unitsize`')}, ${this.money('`plotarea`')}),
            CAST(NULLIF(TRIM(\`car_nos\`), '') AS UNSIGNED),
            ${this.furnishedCase('`furnishing_status`')},
            JSON_OBJECT(
              'legacy_table', 'commercial_space',
              'legacy_id', \`id\`,
              'property_use', \`propertyuse\`,
              'age_of_property', \`ageofproperty\`,
              'facing', \`facing\`
            )
          FROM \`commercial_space\`
        `,
      },
      {
        table: 'industrial_spaces',
        sql: `
          INSERT IGNORE INTO \`property_details\` (
            \`property_id\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`parking\`, \`furnished\`, \`extra_json\`
          )
          SELECT
            (700000000 + CAST(\`id\` AS UNSIGNED)),
            NULL,
            NULL,
            COALESCE(${this.money('`buildup_area`')}, ${this.money('`plot_area`')}, ${this.money('`covered_area`')}),
            CAST(NULLIF(TRIM(\`car_parking_nos\`), '') AS UNSIGNED),
            0,
            JSON_OBJECT(
              'legacy_table', 'industrial_spaces',
              'legacy_id', \`id\`,
              'building_type', \`building_type\`,
              'property_use', \`propertyuse\`,
              'age_of_property', \`age_of_property\`
            )
          FROM \`industrial_spaces\`
        `,
      },
      {
        table: 'coworkers',
        sql: `
          INSERT IGNORE INTO \`property_details\` (
            \`property_id\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`parking\`, \`furnished\`, \`extra_json\`
          )
          SELECT
            (800000000 + CAST(\`id\` AS UNSIGNED)),
            NULL,
            NULL,
            COALESCE(${this.money('`carpet_area`')}, ${this.money('`buildup_area`')}),
            CAST(NULLIF(TRIM(\`carparking_nos\`), '') AS UNSIGNED),
            0,
            JSON_OBJECT(
              'legacy_table', 'coworkers',
              'legacy_id', \`id\`,
              'workstations', \`workstation_available_nos\`,
              'private_cabins', \`private_cabins_nos\`,
              'meeting_rooms', \`meeting_rooms_nos\`
            )
          FROM \`coworkers\`
        `,
      },
    ];

    for (const statement of statements) {
      if (await queryRunner.hasTable(statement.table)) {
        await queryRunner.query(statement.sql);
      }
    }
  }

  private async migratePropertyImages(queryRunner: QueryRunner): Promise<void> {
    const imageStatements: Array<{
      table: string;
      offset: number;
      createdAt: string;
    }> = [
      { table: 'apartment', offset: 100000000, createdAt: 'created_at' },
      { table: 'villas', offset: 200000000, createdAt: 'created_at' },
      {
        table: 'individual_portions',
        offset: 300000000,
        createdAt: 'created_at',
      },
      { table: 'plots', offset: 400000000, createdAt: 'created_at' },
      { table: 'farmlands', offset: 500000000, createdAt: 'created_at' },
      { table: 'commercial_space', offset: 600000000, createdAt: 'created_at' },
      {
        table: 'industrial_spaces',
        offset: 700000000,
        createdAt: 'created_at',
      },
      { table: 'coworkers', offset: 800000000, createdAt: 'created_at' },
    ];

    for (const source of imageStatements) {
      if (!(await queryRunner.hasTable(source.table))) {
        continue;
      }

      await queryRunner.query(`
        INSERT IGNORE INTO \`property_images\` (
          \`property_id\`, \`image_url\`, \`image_key\`, \`is_primary\`, \`created_at\`
        )
        SELECT
          \`property_id\`,
          \`image_url\`,
          \`image_url\`,
          CASE WHEN \`seq\` = 1 THEN 1 ELSE 0 END,
          \`created_at\`
        FROM (
          SELECT (${source.offset} + CAST(\`id\` AS UNSIGNED)) AS \`property_id\`, NULLIF(TRIM(\`photo1\`), '') AS \`image_url\`, 1 AS \`seq\`, COALESCE(\`${source.createdAt}\`, NOW()) AS \`created_at\` FROM \`${source.table}\`
          UNION ALL
          SELECT (${source.offset} + CAST(\`id\` AS UNSIGNED)) AS \`property_id\`, NULLIF(TRIM(\`photo2\`), '') AS \`image_url\`, 2 AS \`seq\`, COALESCE(\`${source.createdAt}\`, NOW()) AS \`created_at\` FROM \`${source.table}\`
          UNION ALL
          SELECT (${source.offset} + CAST(\`id\` AS UNSIGNED)) AS \`property_id\`, NULLIF(TRIM(\`photo3\`), '') AS \`image_url\`, 3 AS \`seq\`, COALESCE(\`${source.createdAt}\`, NOW()) AS \`created_at\` FROM \`${source.table}\`
          UNION ALL
          SELECT (${source.offset} + CAST(\`id\` AS UNSIGNED)) AS \`property_id\`, NULLIF(TRIM(\`photo4\`), '') AS \`image_url\`, 4 AS \`seq\`, COALESCE(\`${source.createdAt}\`, NOW()) AS \`created_at\` FROM \`${source.table}\`
          UNION ALL
          SELECT (${source.offset} + CAST(\`id\` AS UNSIGNED)) AS \`property_id\`, NULLIF(TRIM(\`photo5\`), '') AS \`image_url\`, 5 AS \`seq\`, COALESCE(\`${source.createdAt}\`, NOW()) AS \`created_at\` FROM \`${source.table}\`
          UNION ALL
          SELECT (${source.offset} + CAST(\`id\` AS UNSIGNED)) AS \`property_id\`, NULLIF(TRIM(\`photo6\`), '') AS \`image_url\`, 6 AS \`seq\`, COALESCE(\`${source.createdAt}\`, NOW()) AS \`created_at\` FROM \`${source.table}\`
          UNION ALL
          SELECT (${source.offset} + CAST(\`id\` AS UNSIGNED)) AS \`property_id\`, NULLIF(TRIM(\`photo7\`), '') AS \`image_url\`, 7 AS \`seq\`, COALESCE(\`${source.createdAt}\`, NOW()) AS \`created_at\` FROM \`${source.table}\`
          UNION ALL
          SELECT (${source.offset} + CAST(\`id\` AS UNSIGNED)) AS \`property_id\`, NULLIF(TRIM(\`photo8\`), '') AS \`image_url\`, 8 AS \`seq\`, COALESCE(\`${source.createdAt}\`, NOW()) AS \`created_at\` FROM \`${source.table}\`
          UNION ALL
          SELECT (${source.offset} + CAST(\`id\` AS UNSIGNED)) AS \`property_id\`, NULLIF(TRIM(\`photo9\`), '') AS \`image_url\`, 9 AS \`seq\`, COALESCE(\`${source.createdAt}\`, NOW()) AS \`created_at\` FROM \`${source.table}\`
          UNION ALL
          SELECT (${source.offset} + CAST(\`id\` AS UNSIGNED)) AS \`property_id\`, NULLIF(TRIM(\`photo10\`), '') AS \`image_url\`, 10 AS \`seq\`, COALESCE(\`${source.createdAt}\`, NOW()) AS \`created_at\` FROM \`${source.table}\`
        ) AS \`img\`
        WHERE \`image_url\` IS NOT NULL
      `);
    }
  }

  private async migratePropertyUnits(queryRunner: QueryRunner): Promise<void> {
    const unitStatements: Array<{ table: string; sql: string }> = [
      {
        table: 'apartment',
        sql: `
          INSERT IGNORE INTO \`property_units\` (
            \`property_id\`, \`unit_code\`, \`unit_type\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`price\`, \`monthly_rent\`, \`furnished\`, \`status\`, \`created_at\`, \`updated_at\`
          )
          SELECT
            (100000000 + CAST(\`id\` AS UNSIGNED)),
            CONCAT('APT-', \`id\`),
            'apartment',
            CAST(NULLIF(SUBSTRING_INDEX(\`unittype\`, 'BHK', 1), '') AS UNSIGNED),
            NULL,
            COALESCE(${this.money('`carpet_area`')}, ${this.money('`build_up_area`')}),
            COALESCE(${this.money('`expectedsaleprice`')}, ${this.money('`price`')}),
            ${this.money('`monthly_rent`')},
            ${this.furnishedCase('`furnishing_status`')},
            ${this.statusCase('`status`')},
            COALESCE(\`created_at\`, NOW()),
            COALESCE(\`updated_at\`, \`created_at\`, NOW())
          FROM \`apartment\`
        `,
      },
      {
        table: 'villas',
        sql: `
          INSERT IGNORE INTO \`property_units\` (
            \`property_id\`, \`unit_code\`, \`unit_type\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`price\`, \`monthly_rent\`, \`furnished\`, \`status\`, \`created_at\`, \`updated_at\`
          )
          SELECT
            (200000000 + CAST(\`id\` AS UNSIGNED)),
            CONCAT('VIL-', \`id\`),
            'villa',
            CAST(NULLIF(SUBSTRING_INDEX(\`configuration\`, 'BHK', 1), '') AS UNSIGNED),
            CAST(NULLIF(TRIM(\`bathroom_nos\`), '') AS UNSIGNED),
            COALESCE(${this.money('`buildup_area`')}, ${this.money('`villa_area`')}),
            COALESCE(${this.money('`expectedsaleprice`')}, ${this.money('`price`')}),
            ${this.money('`monthly_rent`')},
            ${this.furnishedCase('`furnishing_status`')},
            ${this.statusCase('`status`')},
            COALESCE(\`created_at\`, NOW()),
            COALESCE(\`updated_at\`, \`created_at\`, NOW())
          FROM \`villas\`
        `,
      },
      {
        table: 'plots',
        sql: `
          INSERT IGNORE INTO \`property_units\` (
            \`property_id\`, \`unit_code\`, \`unit_type\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`price\`, \`monthly_rent\`, \`furnished\`, \`status\`, \`created_at\`, \`updated_at\`
          )
          SELECT
            (400000000 + CAST(\`id\` AS UNSIGNED)),
            CONCAT('PLOT-', \`id\`),
            'plot',
            NULL,
            NULL,
            ${this.money('`total_area`')},
            COALESCE(${this.money('`expectedsaleprice`')}, ${this.money('`price`')}),
            ${this.money('`monthly_rent`')},
            0,
            ${this.statusCase('`status`')},
            COALESCE(\`created_at\`, NOW()),
            COALESCE(\`updated_at\`, \`created_at\`, NOW())
          FROM \`plots\`
        `,
      },
      {
        table: 'commercial_space',
        sql: `
          INSERT IGNORE INTO \`property_units\` (
            \`property_id\`, \`unit_code\`, \`unit_type\`, \`bedrooms\`, \`bathrooms\`, \`area_sqft\`, \`price\`, \`monthly_rent\`, \`furnished\`, \`status\`, \`created_at\`, \`updated_at\`
          )
          SELECT
            (600000000 + CAST(\`id\` AS UNSIGNED)),
            CONCAT('COM-', \`id\`),
            'commercial',
            NULL,
            NULL,
            COALESCE(${this.money('`unitsize`')}, ${this.money('`carpet_area`')}, ${this.money('`plotarea`')}),
            COALESCE(${this.money('`expectedsaleprice`')}, ${this.money('`price`')}),
            ${this.money('`monthly_rent`')},
            ${this.furnishedCase('`furnishing_status`')},
            ${this.statusCase('`status`')},
            COALESCE(\`created_at\`, NOW()),
            COALESCE(\`updated_at\`, \`created_at\`, NOW())
          FROM \`commercial_space\`
        `,
      },
    ];

    for (const statement of unitStatements) {
      if (await queryRunner.hasTable(statement.table)) {
        await queryRunner.query(statement.sql);
      }
    }
  }

  private async migrateAmenities(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT IGNORE INTO \`amenities\` (\`name\`, \`slug\`, \`category\`, \`created_at\`, \`updated_at\`) VALUES
      ('Power Backup', 'power-backup', 'utility', NOW(), NOW()),
      ('Lift', 'lift', 'feature', NOW(), NOW()),
      ('Parking', 'parking', 'feature', NOW(), NOW()),
      ('WiFi', 'wifi', 'connectivity', NOW(), NOW()),
      ('CCTV', 'cctv', 'security', NOW(), NOW()),
      ('Pantry', 'pantry', 'feature', NOW(), NOW())
    `);

    if (await queryRunner.hasTable('propertyuses')) {
      await queryRunner.query(`
        INSERT IGNORE INTO \`amenities\` (\`name\`, \`slug\`, \`category\`, \`created_at\`, \`updated_at\`)
        SELECT
          TRIM(\`propertyuse\`),
          LOWER(REPLACE(REPLACE(TRIM(\`propertyuse\`), ' ', '-'), '/', '-')),
          'other',
          NOW(),
          NOW()
        FROM \`propertyuses\`
        WHERE COALESCE(TRIM(\`propertyuse\`), '') <> ''
      `);
    }

    const amenityMappings: Array<{
      table: string;
      offset: number;
      slug: string;
      flagColumn: string;
    }> = [
      {
        table: 'apartment',
        offset: 100000000,
        slug: 'power-backup',
        flagColumn: 'power_backup',
      },
      {
        table: 'apartment',
        offset: 100000000,
        slug: 'lift',
        flagColumn: 'lift',
      },
      {
        table: 'apartment',
        offset: 100000000,
        slug: 'parking',
        flagColumn: 'guest_parking',
      },
      {
        table: 'commercial_space',
        offset: 600000000,
        slug: 'power-backup',
        flagColumn: 'powerbackup',
      },
      {
        table: 'commercial_space',
        offset: 600000000,
        slug: 'lift',
        flagColumn: 'liftfacility',
      },
      {
        table: 'commercial_space',
        offset: 600000000,
        slug: 'parking',
        flagColumn: 'parking',
      },
      {
        table: 'commercial_space',
        offset: 600000000,
        slug: 'pantry',
        flagColumn: 'pantry',
      },
      {
        table: 'commercial_space',
        offset: 600000000,
        slug: 'wifi',
        flagColumn: 'broadband',
      },
      {
        table: 'industrial_spaces',
        offset: 700000000,
        slug: 'power-backup',
        flagColumn: 'power_backup',
      },
      {
        table: 'industrial_spaces',
        offset: 700000000,
        slug: 'parking',
        flagColumn: 'parking_facility',
      },
      {
        table: 'coworkers',
        offset: 800000000,
        slug: 'wifi',
        flagColumn: 'wifi',
      },
      {
        table: 'coworkers',
        offset: 800000000,
        slug: 'power-backup',
        flagColumn: 'power_backup',
      },
      {
        table: 'coworkers',
        offset: 800000000,
        slug: 'cctv',
        flagColumn: 'cctv',
      },
      {
        table: 'coworkers',
        offset: 800000000,
        slug: 'pantry',
        flagColumn: 'pantry',
      },
      {
        table: 'coworkers',
        offset: 800000000,
        slug: 'parking',
        flagColumn: 'parking',
      },
    ];

    for (const mapping of amenityMappings) {
      if (!(await queryRunner.hasTable(mapping.table))) {
        continue;
      }
      if (
        !(await this.safeHasColumn(
          queryRunner,
          mapping.table,
          mapping.flagColumn,
        ))
      ) {
        continue;
      }

      await queryRunner.query(`
        INSERT IGNORE INTO \`property_amenities\` (\`property_id\`, \`amenity_id\`, \`created_at\`)
        SELECT
          (${mapping.offset} + CAST(\`t\`.\`id\` AS UNSIGNED)) AS \`property_id\`,
          \`a\`.\`id\` AS \`amenity_id\`,
          NOW()
        FROM \`${mapping.table}\` \`t\`
        INNER JOIN \`amenities\` \`a\` ON \`a\`.\`slug\` = '${mapping.slug}'
        WHERE COALESCE(TRIM(CAST(\`t\`.\`${mapping.flagColumn}\` AS CHAR)), '') <> ''
          AND LOWER(TRIM(CAST(\`t\`.\`${mapping.flagColumn}\` AS CHAR))) NOT IN ('0', 'no', 'false', 'n')
      `);
    }
  }

  private async migrateLeads(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('enquiry')) {
      await queryRunner.query(`
        INSERT IGNORE INTO \`leads\` (
          \`property_id\`, \`user_id\`, \`name\`, \`email\`, \`phone\`, \`message\`, \`status\`, \`created_at\`
        )
        SELECT
          COALESCE(
            (
              SELECT \`p\`.\`id\`
              FROM \`properties\` \`p\`
              WHERE \`p\`.\`id\` = ${this.legacyPropertyIdCase(
                "COALESCE(NULLIF(TRIM(`e`.`property_type`), ''), NULLIF(TRIM(`e`.`propertytype`), ''))",
                "CAST(NULLIF(TRIM(`e`.`propertyid`), '') AS UNSIGNED)",
              )}
              LIMIT 1
            ),
            999
          ) AS \`property_id\`,
          (
            SELECT \`u\`.\`id\`
            FROM \`users\` \`u\`
            WHERE \`u\`.\`email\` = COALESCE(NULLIF(TRIM(\`e\`.\`email\`), ''), '')
            LIMIT 1
          ) AS \`user_id\`,
          COALESCE(NULLIF(TRIM(\`e\`.\`name\`), ''), CONCAT('Legacy Lead #', \`e\`.\`id\`)) AS \`name\`,
          COALESCE(NULLIF(TRIM(\`e\`.\`email\`), ''), CONCAT('legacy-lead-', \`e\`.\`id\`, '@majestan.local')) AS \`email\`,
          COALESCE(NULLIF(TRIM(\`e\`.\`phone\`), ''), NULLIF(TRIM(\`e\`.\`mobileno\`), ''), '') AS \`phone\`,
          COALESCE(NULLIF(TRIM(\`e\`.\`message\`), ''), NULLIF(TRIM(\`e\`.\`requirement\`), ''), '') AS \`message\`,
          CASE
            WHEN LOWER(COALESCE(TRIM(CAST(\`e\`.\`status\` AS CHAR)), '')) IN ('0', 'closed') THEN 'closed'
            ELSE 'new'
          END AS \`status\`,
          COALESCE(\`e\`.\`created_at\`, NOW()) AS \`created_at\`
        FROM \`enquiry\` \`e\`
      `);
    }

    if (await queryRunner.hasTable('propertydetails')) {
      await queryRunner.query(`
        INSERT IGNORE INTO \`leads\` (
          \`property_id\`, \`user_id\`, \`name\`, \`email\`, \`phone\`, \`message\`, \`status\`, \`created_at\`
        )
        SELECT
          999 AS \`property_id\`,
          NULL AS \`user_id\`,
          COALESCE(NULLIF(TRIM(\`pd\`.\`name\`), ''), CONCAT('Legacy Interest #', \`pd\`.\`id\`)) AS \`name\`,
          COALESCE(NULLIF(TRIM(\`pd\`.\`email\`), ''), CONCAT('legacy-interest-', \`pd\`.\`id\`, '@majestan.local')) AS \`email\`,
          COALESCE(NULLIF(TRIM(\`pd\`.\`phone\`), ''), NULLIF(TRIM(\`pd\`.\`mobilenumber\`), ''), '') AS \`phone\`,
          COALESCE(NULLIF(TRIM(\`pd\`.\`message\`), ''), NULLIF(TRIM(\`pd\`.\`property_details\`), ''), '') AS \`message\`,
          CASE
            WHEN LOWER(COALESCE(TRIM(CAST(\`pd\`.\`status\` AS CHAR)), '')) IN ('0', 'closed') THEN 'closed'
            ELSE 'new'
          END AS \`status\`,
          COALESCE(\`pd\`.\`created_at\`, NOW()) AS \`created_at\`
        FROM \`propertydetails\` \`pd\`
      `);
    }
  }

  private async migrateWishlists(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('wishlist'))) {
      return;
    }

    await queryRunner.query(`
      INSERT IGNORE INTO \`wishlists\` (\`user_id\`, \`property_id\`, \`created_at\`)
      SELECT
        COALESCE(
          (
            SELECT \`u\`.\`id\`
            FROM \`users\` \`u\`
            WHERE \`u\`.\`id\` = CAST(NULLIF(TRIM(\`w\`.\`user_id\`), '') AS UNSIGNED)
            LIMIT 1
          ),
          (
            SELECT \`u2\`.\`id\`
            FROM \`users\` \`u2\`
            WHERE \`u2\`.\`email\` = CONCAT(
              'legacy-wishlist-',
              LOWER(REPLACE(REPLACE(REPLACE(TRIM(\`w\`.\`user_id\`), ' ', '-'), '@', '-'), '.', '-')),
              '@majestan.local'
            )
            LIMIT 1
          ),
          1
        ) AS \`user_id\`,
        COALESCE(
          (
            SELECT \`p\`.\`id\`
            FROM \`properties\` \`p\`
            WHERE \`p\`.\`id\` = ${this.legacyPropertyIdCase(
              "COALESCE(NULLIF(TRIM(`w`.`property_type`), ''), '')",
              "CAST(NULLIF(TRIM(`w`.`property_id`), '') AS UNSIGNED)",
            )}
            LIMIT 1
          ),
          999
        ) AS \`property_id\`,
        COALESCE(\`w\`.\`wish_date\`, \`w\`.\`created_at\`, NOW()) AS \`created_at\`
      FROM \`wishlist\` \`w\`
      WHERE COALESCE(TRIM(\`w\`.\`property_id\`), '') <> ''
    `);
  }

  private async migrateBlogs(queryRunner: QueryRunner): Promise<void> {
    const hasLegacyBlogs = await queryRunner.hasTable('legacy_blogs');
    if (!hasLegacyBlogs) {
      return;
    }

    await queryRunner.query(`
      INSERT IGNORE INTO \`blogs\` (
        \`id\`, \`title\`, \`slug\`, \`content\`, \`author_id\`, \`status\`, \`created_at\`
      )
      SELECT
        CAST(\`b\`.\`id\` AS UNSIGNED) AS \`id\`,
        COALESCE(NULLIF(TRIM(\`b\`.\`title\`), ''), NULLIF(TRIM(\`b\`.\`blog_title\`), ''), CONCAT('Legacy Blog #', \`b\`.\`id\`)) AS \`title\`,
        CONCAT('legacy-blog-', \`b\`.\`id\`) AS \`slug\`,
        COALESCE(NULLIF(\`b\`.\`content\`, ''), NULLIF(\`b\`.\`blog_content\`, ''), '') AS \`content\`,
        1 AS \`author_id\`,
        CASE
          WHEN CAST(COALESCE(\`b\`.\`status\`, 1) AS SIGNED) = 1 THEN 'published'
          ELSE 'draft'
        END AS \`status\`,
        COALESCE(\`b\`.\`created_at\`, NOW()) AS \`created_at\`
      FROM \`legacy_blogs\` \`b\`
    `);
  }

  private money(columnExpression: string): string {
    return `CAST(NULLIF(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(${columnExpression}), ',', ''), '₹', ''), 'Rs.', ''), 'Rs', ''), ' ', ''), '') AS DECIMAL(12,2))`;
  }

  private furnishedCase(columnExpression: string): string {
    return `
      CASE
        WHEN LOWER(COALESCE(TRIM(CAST(${columnExpression} AS CHAR)), '')) LIKE '%furnished%' THEN 1
        WHEN LOWER(COALESCE(TRIM(CAST(${columnExpression} AS CHAR)), '')) IN ('yes', 'y', 'true', '1') THEN 1
        ELSE 0
      END
    `;
  }

  private statusCase(columnExpression: string): string {
    return `
      CASE
        WHEN LOWER(COALESCE(TRIM(CAST(${columnExpression} AS CHAR)), '')) IN ('sold', '2', 'closed') THEN 'sold'
        WHEN LOWER(COALESCE(TRIM(CAST(${columnExpression} AS CHAR)), '')) IN ('rented', 'rent', '3', 'leased') THEN 'rented'
        ELSE 'available'
      END
    `;
  }

  private legacyPropertyIdCase(
    propertyTypeExpression: string,
    propertyIdExpression: string,
  ): string {
    return `
      CASE
        WHEN LOWER(COALESCE(${propertyTypeExpression}, '')) LIKE '%apart%' THEN (100000000 + ${propertyIdExpression})
        WHEN LOWER(COALESCE(${propertyTypeExpression}, '')) LIKE '%villa%' THEN (200000000 + ${propertyIdExpression})
        WHEN LOWER(COALESCE(${propertyTypeExpression}, '')) LIKE '%individual%' THEN (300000000 + ${propertyIdExpression})
        WHEN LOWER(COALESCE(${propertyTypeExpression}, '')) LIKE '%plot%' THEN (400000000 + ${propertyIdExpression})
        WHEN LOWER(COALESCE(${propertyTypeExpression}, '')) LIKE '%farm%' THEN (500000000 + ${propertyIdExpression})
        WHEN LOWER(COALESCE(${propertyTypeExpression}, '')) LIKE '%commercial%' THEN (600000000 + ${propertyIdExpression})
        WHEN LOWER(COALESCE(${propertyTypeExpression}, '')) LIKE '%industrial%' THEN (700000000 + ${propertyIdExpression})
        WHEN LOWER(COALESCE(${propertyTypeExpression}, '')) LIKE '%cowork%' THEN (800000000 + ${propertyIdExpression})
        ELSE NULL
      END
    `;
  }

  private async safeHasColumn(
    queryRunner: QueryRunner,
    table: string,
    column: string,
  ): Promise<boolean> {
    try {
      return await queryRunner.hasColumn(table, column);
    } catch {
      return false;
    }
  }
}
