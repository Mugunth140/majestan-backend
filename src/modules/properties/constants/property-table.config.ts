import { PropertyType } from '../../../common/enums/property-type.enum';

export type PropertyTableConfig = {
  table: string;
  legacyWishlistType: string;
  sellPriceColumn: string;
  rentPriceColumn?: string;
  areaColumn: string;
  unitColumn?: string;
  furnishingColumn?: string;
  floorColumn?: string;
  facingColumn?: string;
  ageColumn?: string;
  propertyUseColumn?: string;
  locationColumn: string;
  nameColumn: string;
};

export const PROPERTY_TABLE_CONFIG: Record<PropertyType, PropertyTableConfig> =
  {
    [PropertyType.Apartment]: {
      table: 'apartment',
      legacyWishlistType: 'Apartment',
      sellPriceColumn: 'expectedsaleprice',
      rentPriceColumn: 'monthly_rent',
      areaColumn: 'build_up_area',
      unitColumn: 'unittype',
      furnishingColumn: 'furnishing_status',
      floorColumn: 'floor',
      facingColumn: 'facing',
      ageColumn: 'property_age',
      locationColumn: 'sublocation',
      nameColumn: 'propertyname',
    },
    [PropertyType.Villa]: {
      table: 'villas',
      legacyWishlistType: 'Villa',
      sellPriceColumn: 'expectedsaleprice',
      rentPriceColumn: 'monthly_rent',
      areaColumn: 'buildup_area',
      unitColumn: 'configuration',
      furnishingColumn: 'furnishing_status',
      floorColumn: 'floor',
      facingColumn: 'facing_direction',
      ageColumn: 'property_age',
      locationColumn: 'sublocation',
      nameColumn: 'propertyname',
    },
    [PropertyType.IndependentHouse]: {
      table: 'individual_portions',
      legacyWishlistType: 'Individual Portion and House',
      sellPriceColumn: 'expectedsaleprice',
      rentPriceColumn: 'monthly_rent',
      areaColumn: 'plot_area',
      unitColumn: 'configuration',
      furnishingColumn: 'furnishing_status',
      floorColumn: 'floor',
      facingColumn: 'facing',
      ageColumn: 'property_age',
      locationColumn: 'sublocation',
      nameColumn: 'propertyname',
    },
    [PropertyType.Plot]: {
      table: 'plots',
      legacyWishlistType: 'plots',
      sellPriceColumn: 'expectedsaleprice',
      rentPriceColumn: 'monthly_rent',
      areaColumn: 'project_area',
      facingColumn: 'facing_direction',
      locationColumn: 'sublocation',
      nameColumn: 'propertyname',
    },
    [PropertyType.Farmland]: {
      table: 'farmlands',
      legacyWishlistType: 'Farm Land',
      sellPriceColumn: 'expectedsaleprice',
      rentPriceColumn: 'monthly_rent',
      areaColumn: 'totalarea',
      facingColumn: 'facing',
      locationColumn: 'sublocation',
      nameColumn: 'propertyname',
    },
    [PropertyType.CommercialSpace]: {
      table: 'commercial_space',
      legacyWishlistType: 'Commercial Space',
      sellPriceColumn: 'expectedsaleprice',
      rentPriceColumn: 'monthly_rent',
      areaColumn: 'unitsize',
      furnishingColumn: 'furnishing_status',
      floorColumn: 'floor',
      facingColumn: 'facing',
      ageColumn: 'ageofproperty',
      propertyUseColumn: 'propertyuse',
      locationColumn: 'sublocation',
      nameColumn: 'propertyname',
    },
    [PropertyType.IndustrialSpace]: {
      table: 'industrial_spaces',
      legacyWishlistType: 'Industrial Space',
      sellPriceColumn: 'expectedsaleprice',
      rentPriceColumn: 'monthly_rent',
      areaColumn: 'buildup_area',
      facingColumn: 'facing',
      ageColumn: 'age_of_property',
      propertyUseColumn: 'propertyuse',
      locationColumn: 'sublocation',
      nameColumn: 'propertyname',
    },
    [PropertyType.Coworking]: {
      table: 'coworkers',
      legacyWishlistType: 'Coworkers',
      sellPriceColumn: 'expected_rent_perseat',
      rentPriceColumn: 'monthly_rent',
      areaColumn: 'buildup_area',
      unitColumn: 'unittype',
      furnishingColumn: 'condition_space',
      floorColumn: 'floor',
      facingColumn: 'facing',
      ageColumn: 'property_age',
      locationColumn: 'sublocation',
      nameColumn: 'propertyname',
    },
  };

const PROPERTY_TYPE_ALIASES: Record<string, PropertyType> = {
  apartment: PropertyType.Apartment,
  villa: PropertyType.Villa,
  'independent-house': PropertyType.IndependentHouse,
  independenthouse: PropertyType.IndependentHouse,
  independent_houses: PropertyType.IndependentHouse,
  plot: PropertyType.Plot,
  plots: PropertyType.Plot,
  farmland: PropertyType.Farmland,
  farmlands: PropertyType.Farmland,
  'commercial-space': PropertyType.CommercialSpace,
  commercialspace: PropertyType.CommercialSpace,
  'industrial-space': PropertyType.IndustrialSpace,
  industrialspace: PropertyType.IndustrialSpace,
  coworking: PropertyType.Coworking,
  coworkers: PropertyType.Coworking,
};

export const resolvePropertyType = (value: string): PropertyType | null => {
  const normalized = value.trim().toLowerCase();
  return PROPERTY_TYPE_ALIASES[normalized] ?? null;
};

export const getPropertyConfig = (type: PropertyType): PropertyTableConfig => {
  return PROPERTY_TABLE_CONFIG[type];
};
