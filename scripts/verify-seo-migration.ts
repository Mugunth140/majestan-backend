import { DataSource, type DataSourceOptions } from 'typeorm';
import source from '../src/database/data-source';
import { SeoCommandCenter1784600000000 } from '../src/database/migrations/1784600000000-SeoCommandCenter';
import { SeoSaleRentTemplates1784700000000 } from '../src/database/migrations/1784700000000-SeoSaleRentTemplates';
async function verify() {
  await source.initialize();
  const database = 'majestan_seo_verify_' + Date.now();
  let test: DataSource | undefined;
  try {
    await source.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4`);
    const original = String(source.options.database);
    for (const table of [
      'properties',
      'projects',
      'cities',
      'sublocations',
      'property_seo',
      'project_seo',
      'listing_page_seo',
      'seo_metadata',
    ]) {
      await source.query(
        `CREATE TABLE \`${database}\`.\`${table}\` LIKE \`${original}\`.\`${table}\``,
      );
      await source.query(
        `INSERT INTO \`${database}\`.\`${table}\` SELECT * FROM \`${original}\`.\`${table}\``,
      );
    }
    test = new DataSource({
      ...source.options,
      database,
      migrations: [
        SeoCommandCenter1784600000000,
        SeoSaleRentTemplates1784700000000,
      ],
      logging: false,
    } as DataSourceOptions);
    await test.initialize();
    await test.runMigrations({ transaction: 'none' });
    const rows = await test.query(
      'SELECT scope,COUNT(*) AS total FROM seo_configs GROUP BY scope',
    );
    const paths = await test.query(
      "SELECT COLLATION_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='seo_configs' AND COLUMN_NAME='public_path'",
      [database],
    );
    if (paths[0].COLLATION_NAME !== 'ascii_bin')
      throw new Error('Unsafe index collation');
    const legacy = (
      await test.query('SELECT COUNT(*) AS n FROM property_seo')
    )[0].n;
    const migrated = (
      await test.query(
        "SELECT COUNT(*) AS n FROM seo_configs WHERE scope='property'",
      )
    )[0].n;
    if (legacy !== migrated) throw new Error('Backfill count mismatch');
    const intents = await test.query(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME='seo_listing_pages' AND COLUMN_NAME='transaction_intent'",
      [database],
    );
    if (intents[0].COLUMN_TYPE !== "enum('buy','rent')")
      throw new Error('Transaction intent enum mismatch');
    const obsolete = await test.query(
      "SELECT COUNT(*) AS n FROM seo_configs WHERE config_key LIKE 'template:%:new' OR config_key LIKE 'template:%:resale'",
    );
    if (Number(obsolete[0].n) !== 0)
      throw new Error('Obsolete SEO templates remain');
    const defaultTemplates = await test.query(
      "SELECT COUNT(*) AS n FROM seo_configs WHERE config_key LIKE 'template:property:%' AND section_seo IS NOT NULL",
    );
    if (Number(defaultTemplates[0].n) !== 16)
      throw new Error('Property section SEO defaults missing');
    console.log('Migration and backfill passed:', JSON.stringify(rows));
    console.log('Sale/rent templates and 512-byte ASCII URL indexes verified.');
  } finally {
    if (test?.isInitialized) await test.destroy();
    await source.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await source.destroy();
  }
}
void verify().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
