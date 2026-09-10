import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { CreateMajestanLegacySchema1778544000000 } from './migrations/1778544000000-CreateMajestanLegacySchema';
import { SeedMajestanReferenceData1778544001000 } from './migrations/1778544001000-SeedMajestanReferenceData';
import { RefactorLegacyToUnifiedSchema1779100000000 } from './migrations/1779100000000-RefactorLegacyToUnifiedSchema';
import { AddPropertySeoSlugColumns1779200000000 } from './migrations/1779200000000-AddPropertySeoSlugColumns';
import { UpdatePropertySeoSlugs1779300000000 } from './migrations/1779300000000-UpdatePropertySeoSlugs';
import { SeedAdminUser1779400000000 } from './migrations/1779400000000-SeedAdminUser';
import { AddManagedCitiesAndSublocations1781020414000 } from './migrations/1781020414000-AddManagedCitiesAndSublocations';
import { AddListingPageSeoTable1756540000000 } from './migrations/1756540000000-AddListingPageSeoTable';
import { AddPropertySeoTable1781500000000 } from './migrations/1781500000000-AddPropertySeoTable';
import { AddCrmOnlyPropertyFields1781600000000 } from './migrations/1781600000000-AddCrmOnlyPropertyFields';
import { AddProjectCodeColumn1781700000000 } from './migrations/1781700000000-AddProjectCodeColumn';
import { ProjectRootCustomSlug1781800000000 } from './migrations/1781800000000-ProjectRootCustomSlug';
import { AddProjectCodeToCanonicalSlug1781900000000 } from './migrations/1781900000000-AddProjectCodeToCanonicalSlug';

const parseBoolean = (value: string | undefined, fallback = false): boolean => {
  if (!value) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const parseInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const sslEnabled = parseBoolean(process.env.DB_SSL, false);

export default new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInteger(process.env.DB_PORT, 3306),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'majestan',
  synchronize: false,
  logging: parseBoolean(process.env.TYPEORM_LOGGING, false),
  migrationsTableName: 'migrations',
  migrations: [
    CreateMajestanLegacySchema1778544000000,
    SeedMajestanReferenceData1778544001000,
    RefactorLegacyToUnifiedSchema1779100000000,
    AddPropertySeoSlugColumns1779200000000,
    UpdatePropertySeoSlugs1779300000000,
    SeedAdminUser1779400000000,
    AddManagedCitiesAndSublocations1781020414000,
    AddListingPageSeoTable1756540000000,
    AddPropertySeoTable1781500000000,
    AddCrmOnlyPropertyFields1781600000000,
    AddProjectCodeColumn1781700000000,
    ProjectRootCustomSlug1781800000000,
    AddProjectCodeToCanonicalSlug1781900000000,
  ],
  extra: {
    connectionLimit: parseInteger(process.env.DB_POOL_SIZE, 10),
  },
  ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
});
