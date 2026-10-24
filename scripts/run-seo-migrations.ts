import { SeoAuditRemediation1785200000000 } from '../src/database/migrations/1785200000000-SeoAuditRemediation';
import { PropertyTypeSeoTemplates1785100000000 } from '../src/database/migrations/1785100000000-PropertyTypeSeoTemplates';
import { SeoCanonicalType1785000000000 } from '../src/database/migrations/1785000000000-SeoCanonicalType';
import dataSource from '../src/database/data-source';
import { SeoCommandCenter1784600000000 } from '../src/database/migrations/1784600000000-SeoCommandCenter';
import { SeoSaleRentTemplates1784700000000 } from '../src/database/migrations/1784700000000-SeoSaleRentTemplates';
import { SeoFieldProvisioning1784800000000 } from '../src/database/migrations/1784800000000-SeoFieldProvisioning';

// Deliberately excludes pending migrations for unrelated inventory features.
async function run(): Promise<void> {
  dataSource.setOptions({
    migrations: [
      SeoAuditRemediation1785200000000,
      SeoCanonicalType1785000000000,
      PropertyTypeSeoTemplates1785100000000,
      SeoCommandCenter1784600000000,
      SeoSaleRentTemplates1784700000000,
      SeoFieldProvisioning1784800000000,
    ],
  });
  await dataSource.initialize();
  try {
    const executed = await dataSource.runMigrations({ transaction: 'none' });
    console.log(
      executed.length
        ? `Executed SEO migrations: ${executed.map((migration) => migration.name).join(', ')}`
        : 'SEO migrations are already applied.',
    );
  } finally {
    await dataSource.destroy();
  }
}
void run().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'SEO migration failed',
  );
  process.exitCode = 1;
});
