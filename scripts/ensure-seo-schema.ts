import { PropertyTypeSeoTemplates1785100000000 } from '../src/database/migrations/1785100000000-PropertyTypeSeoTemplates';
import { SeoAuditRemediation1785200000000 } from '../src/database/migrations/1785200000000-SeoAuditRemediation';
import dataSource from '../src/database/data-source';
import { SeoCanonicalType1785000000000 } from '../src/database/migrations/1785000000000-SeoCanonicalType';

async function run() {
  dataSource.setOptions({ migrations: [SeoCanonicalType1785000000000, PropertyTypeSeoTemplates1785100000000, SeoAuditRemediation1785200000000] });
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'none' });
    console.log(`SEO schema ready (${applied.length} migration applied).`);
  } finally { await dataSource.destroy(); }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
