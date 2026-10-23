import dataSource from '../src/database/data-source';
import { SeoCanonicalType1785000000000 } from '../src/database/migrations/1785000000000-SeoCanonicalType';

async function run() {
  dataSource.setOptions({ migrations: [SeoCanonicalType1785000000000] });
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'none' });
    console.log(`SEO schema ready (${applied.length} migration applied).`);
  } finally { await dataSource.destroy(); }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
