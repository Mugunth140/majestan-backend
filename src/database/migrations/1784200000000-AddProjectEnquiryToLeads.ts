import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Project enquiries: leads can now reference a project instead of a property.
 * - adds nullable `leads.project_id` (FK -> projects.id, indexed)
 * - relaxes `leads.property_id` to NULL (project-based leads carry none)
 *
 * Idempotent throughout: columns/indexes/constraints may already exist where
 * they were added out-of-band. Only environments missing them get the ALTER.
 */
export class AddProjectEnquiryToLeads1784200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = async (name: string): Promise<boolean> => {
      const rows: Array<{ n: string | number }> = await queryRunner.query(`
        SELECT COUNT(*) AS n
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'leads'
          AND COLUMN_NAME = '${name}';
      `);
      return Number(rows?.[0]?.n ?? 0) > 0;
    };

    const foreignKeysOn = async (column: string): Promise<string[]> => {
      const rows: Array<{ name: string }> = await queryRunner.query(`
        SELECT CONSTRAINT_NAME AS name
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'leads'
          AND COLUMN_NAME = '${column}'
          AND REFERENCED_TABLE_NAME IS NOT NULL;
      `);
      return (rows ?? []).map((r) => r.name).filter(Boolean);
    };

    // 1. project_id column.
    if (!(await hasColumn('project_id'))) {
      await queryRunner.query(`
        ALTER TABLE \`leads\`
        ADD COLUMN \`project_id\` int unsigned NULL AFTER \`property_id\`;
      `);
    }

    // 2. property_id becomes nullable (requires dropping its FK first —
    // MySQL refuses to MODIFY a column used in a foreign key constraint).
    const propertyNullable: Array<{ nullable: string }> =
      await queryRunner.query(`
        SELECT IS_NULLABLE AS nullable
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'leads'
          AND COLUMN_NAME = 'property_id';
      `);
    if ((propertyNullable?.[0]?.nullable ?? 'YES') === 'NO') {
      const fks = await foreignKeysOn('property_id');
      for (const fk of fks) {
        await queryRunner.query(
          `ALTER TABLE \`leads\` DROP FOREIGN KEY \`${fk}\`;`,
        );
      }
      await queryRunner.query(`
        ALTER TABLE \`leads\`
        MODIFY COLUMN \`property_id\` int unsigned NULL;
      `);
      if (fks.length === 0) {
        await queryRunner.query(`
          ALTER TABLE \`leads\`
          ADD CONSTRAINT \`fk_leads_property\` FOREIGN KEY (\`property_id\`)
          REFERENCES \`properties\` (\`id\`) ON UPDATE NO ACTION ON DELETE CASCADE;
        `);
      } else {
        for (const fk of fks) {
          await queryRunner.query(`
            ALTER TABLE \`leads\`
            ADD CONSTRAINT \`${fk}\` FOREIGN KEY (\`property_id\`)
            REFERENCES \`properties\` (\`id\`) ON UPDATE NO ACTION ON DELETE CASCADE;
          `);
        }
      }
    }

    // 3. index on project_id.
    const indexRows: Array<{ n: string | number }> = await queryRunner.query(`
      SELECT COUNT(*) AS n
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leads'
        AND INDEX_NAME = 'idx_leads_project_id';
    `);
    if (Number(indexRows?.[0]?.n ?? 0) === 0) {
      await queryRunner.query(`
        ALTER TABLE \`leads\`
        ADD KEY \`idx_leads_project_id\` (\`project_id\`);
      `);
    }

    // 4. FK project_id -> projects.id (mirrors the property FK's rules).
    if ((await foreignKeysOn('project_id')).length === 0) {
      await queryRunner.query(`
        ALTER TABLE \`leads\`
        ADD CONSTRAINT \`fk_leads_project\` FOREIGN KEY (\`project_id\`)
        REFERENCES \`projects\` (\`id\`) ON UPDATE NO ACTION ON DELETE CASCADE;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const foreignKeysOn = async (column: string): Promise<string[]> => {
      const rows: Array<{ name: string }> = await queryRunner.query(`
        SELECT CONSTRAINT_NAME AS name
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'leads'
          AND COLUMN_NAME = '${column}'
          AND REFERENCED_TABLE_NAME IS NOT NULL;
      `);
      return (rows ?? []).map((r) => r.name).filter(Boolean);
    };

    for (const fk of await foreignKeysOn('project_id')) {
      await queryRunner.query(
        `ALTER TABLE \`leads\` DROP FOREIGN KEY \`${fk}\`;`,
      );
    }

    const indexRows: Array<{ n: string | number }> = await queryRunner.query(`
      SELECT COUNT(*) AS n
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leads'
        AND INDEX_NAME = 'idx_leads_project_id';
    `);
    if (Number(indexRows?.[0]?.n ?? 0) > 0) {
      await queryRunner.query(`
        ALTER TABLE \`leads\` DROP KEY \`idx_leads_project_id\`;
      `);
    }

    const colRows: Array<{ n: string | number }> = await queryRunner.query(`
      SELECT COUNT(*) AS n
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'leads'
        AND COLUMN_NAME = 'project_id';
    `);
    if (Number(colRows?.[0]?.n ?? 0) > 0) {
      await queryRunner.query(`
        ALTER TABLE \`leads\` DROP COLUMN \`project_id\`;
      `);
    }
    // property_id stays nullable: restoring NOT NULL is unsafe while
    // project-based leads exist, so down() deliberately leaves it alone.
  }
}
