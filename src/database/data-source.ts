import { CommercialRentalSpecialPurpose1786200000000 } from './migrations/1786200000000-CommercialRentalSpecialPurpose';
import { IndustrialLandAndFarmHouse1786100000000 } from './migrations/1786100000000-IndustrialLandAndFarmHouse';
import { PropertySpecificationRefinements1786000000000 } from './migrations/1786000000000-PropertySpecificationRefinements';
import { AddPropertyPricePerSqft1785900000000 } from './migrations/1785900000000-AddPropertyPricePerSqft';
import { AddPgServiceApartmentType1785800000000 } from './migrations/1785800000000-AddPgServiceApartmentType';
import { AddInvestmentPropertyType1785700000000 } from './migrations/1785700000000-AddInvestmentPropertyType';
import { AddBlogKeywords1785600000000 } from './migrations/1785600000000-AddBlogKeywords';
import { SanitizePropertySlugs1785500000000 } from './migrations/1785500000000-SanitizePropertySlugs';
import { CreateBlogPosts1785400000000 } from './migrations/1785400000000-CreateBlogPosts';
import { AddArchivedPropertyStatus1785300000000 } from './migrations/1785300000000-AddArchivedPropertyStatus';
import { SeoAuditRemediation1785200000000 } from './migrations/1785200000000-SeoAuditRemediation';
import { PropertyTypeSeoTemplates1785100000000 } from './migrations/1785100000000-PropertyTypeSeoTemplates';
import { SeoCanonicalType1785000000000 } from './migrations/1785000000000-SeoCanonicalType';
import { SeoFieldProvisioning1784800000000 } from './migrations/1784800000000-SeoFieldProvisioning';
import { SeoCommandCenter1784600000000 } from './migrations/1784600000000-SeoCommandCenter';
import { SeoSaleRentTemplates1784700000000 } from './migrations/1784700000000-SeoSaleRentTemplates';
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
import { AddParkingTypeAndFloorFacing1782000000000 } from './migrations/1782000000000-AddParkingTypeAndFloorFacing';
import { MakeFurnishedNullable1782200000000 } from './migrations/1782200000000-MakeFurnishedNullable';
import { CreateFurnishingItems1782300000000 } from './migrations/1782300000000-CreateFurnishingItems';
import { CreateUtilities1782400000000 } from './migrations/1782400000000-CreateUtilities';
import { AddProjectApartmentVillaDetails1782500000000 } from './migrations/1782500000000-AddProjectApartmentVillaDetails';
import { AddProjectBookedNewLaunchAndAvailability1782600000000 } from './migrations/1782600000000-AddProjectBookedNewLaunchAndAvailability';
import { AddBareshellFurnishedStatus1782700000000 } from './migrations/1782700000000-AddBareshellFurnishedStatus';
import { UpdateProjectCodeScheme1782800000000 } from './migrations/1782800000000-UpdateProjectCodeScheme';
import { AddMobileCoverImage1782900000000 } from './migrations/1782900000000-AddMobileCoverImage';
import { AddProjectVideoUrls1783000000000 } from './migrations/1783000000000-AddProjectVideoUrls';
import { CreateBuildersTable1783100000000 } from './migrations/1783100000000-CreateBuildersTable';
import { AddIndustrialPortingFields1783200000000 } from './migrations/1783200000000-AddIndustrialPortingFields';
import { AddCommercialPortingFields1783300000000 } from './migrations/1783300000000-AddCommercialPortingFields';
import { AddProjectVideos1783400000000 } from './migrations/1783400000000-AddProjectVideos';
import { ChangeProjectUnitFloorNoToVarchar1783500000000 } from './migrations/1783500000000-ChangeProjectUnitFloorNoToVarchar';
import { OwnerPostIntake1783600000000 } from './migrations/1783600000000-OwnerPostIntake';
import { AddHigherBhkUnitTypes1783700000000 } from './migrations/1783700000000-AddHigherBhkUnitTypes';

import { AddProjectRevision1783800000000 } from './migrations/1783800000000-AddProjectRevision';
import { AddProjectUnitFloorPlans1783900000000 } from './migrations/1783900000000-AddProjectUnitFloorPlans';
import { ExtendAdPlacements1784000000000 } from './migrations/1784000000000-ExtendAdPlacements';
import { AddProjectFaqSection1784100000000 } from './migrations/1784100000000-AddProjectFaqSection';
import { AddProjectEnquiryToLeads1784200000000 } from './migrations/1784200000000-AddProjectEnquiryToLeads';
import { AddProjectFieldRevisions1784300000000 } from './migrations/1784300000000-AddProjectFieldRevisions';
import { CreateShowcaseItems1784400000000 } from './migrations/1784400000000-CreateShowcaseItems';
import { CreateSavedListings1784500000000 } from './migrations/1784500000000-CreateSavedListings';

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
    CommercialRentalSpecialPurpose1786200000000,
    IndustrialLandAndFarmHouse1786100000000,
    PropertySpecificationRefinements1786000000000,
    AddPropertyPricePerSqft1785900000000,
    AddPgServiceApartmentType1785800000000,
    AddInvestmentPropertyType1785700000000,
    SanitizePropertySlugs1785500000000,
    CreateBlogPosts1785400000000,
    AddBlogKeywords1785600000000,
    AddArchivedPropertyStatus1785300000000,
    SeoAuditRemediation1785200000000,
    SeoCanonicalType1785000000000,
    PropertyTypeSeoTemplates1785100000000,
    SeoCommandCenter1784600000000,
    SeoSaleRentTemplates1784700000000,
    SeoFieldProvisioning1784800000000,
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
    AddParkingTypeAndFloorFacing1782000000000,
    MakeFurnishedNullable1782200000000,
    CreateFurnishingItems1782300000000,
    CreateUtilities1782400000000,
    AddProjectApartmentVillaDetails1782500000000,
    AddProjectBookedNewLaunchAndAvailability1782600000000,
    AddBareshellFurnishedStatus1782700000000,
    UpdateProjectCodeScheme1782800000000,
    AddMobileCoverImage1782900000000,
    AddProjectVideoUrls1783000000000,
    CreateBuildersTable1783100000000,
    AddIndustrialPortingFields1783200000000,
    AddCommercialPortingFields1783300000000,
    AddProjectVideos1783400000000,
    ChangeProjectUnitFloorNoToVarchar1783500000000,
    OwnerPostIntake1783600000000,
    AddHigherBhkUnitTypes1783700000000,
    AddProjectRevision1783800000000,
    AddProjectUnitFloorPlans1783900000000,
    ExtendAdPlacements1784000000000,
    AddProjectFaqSection1784100000000,
    AddProjectEnquiryToLeads1784200000000,
    AddProjectFieldRevisions1784300000000,
    CreateShowcaseItems1784400000000,
    CreateSavedListings1784500000000,
  ],
  extra: {
    connectionLimit: parseInteger(process.env.DB_POOL_SIZE, 10),
  },
  ssl: sslEnabled ? { rejectUnauthorized: true } : undefined,
});
