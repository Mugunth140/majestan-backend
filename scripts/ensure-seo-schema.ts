import { CommercialRentalSpecialPurpose1786200000000 } from '../src/database/migrations/1786200000000-CommercialRentalSpecialPurpose';
import { IndustrialLandAndFarmHouse1786100000000 } from '../src/database/migrations/1786100000000-IndustrialLandAndFarmHouse';
import { PropertySpecificationRefinements1786000000000 } from '../src/database/migrations/1786000000000-PropertySpecificationRefinements';
import { AddInvestmentPropertyType1785700000000 } from '../src/database/migrations/1785700000000-AddInvestmentPropertyType';
import { AddPgServiceApartmentType1785800000000 } from '../src/database/migrations/1785800000000-AddPgServiceApartmentType';
import { AddPropertyPricePerSqft1785900000000 } from '../src/database/migrations/1785900000000-AddPropertyPricePerSqft';
import { PropertyTypeSeoTemplates1785100000000 } from '../src/database/migrations/1785100000000-PropertyTypeSeoTemplates';
import { SeoAuditRemediation1785200000000 } from '../src/database/migrations/1785200000000-SeoAuditRemediation';
import { SanitizePropertySlugs1785500000000 } from '../src/database/migrations/1785500000000-SanitizePropertySlugs';
import dataSource from '../src/database/data-source';
import { SeoCanonicalType1785000000000 } from '../src/database/migrations/1785000000000-SeoCanonicalType';

async function run() {
  dataSource.setOptions({ migrations: [SeoCanonicalType1785000000000, PropertyTypeSeoTemplates1785100000000, SeoAuditRemediation1785200000000, SanitizePropertySlugs1785500000000, AddInvestmentPropertyType1785700000000, AddPgServiceApartmentType1785800000000, AddPropertyPricePerSqft1785900000000, PropertySpecificationRefinements1786000000000, IndustrialLandAndFarmHouse1786100000000, CommercialRentalSpecialPurpose1786200000000] });
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'none' });
    console.log(`SEO schema ready (${applied.length} migration applied).`);
  } finally { await dataSource.destroy(); }
}
void run().catch(error => { console.error(error); process.exitCode = 1; });
