import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ListingType } from '../../../common/enums/listing-type.enum';
import { PropertyType } from '../../../common/enums/property-type.enum';
import { normalizeArray } from '../../../common/utils/normalize-array.util';

export enum PropertySortOption {
  PriceLowToHigh = 'low_to_high',
  PriceHighToLow = 'high_to_low',
  AreaLowToHigh = 'Area_low_to_high',
  AreaHighToLow = 'Area_high_to_low',
}

export class PropertySearchQueryDto {
  @IsOptional()
  @IsEnum(PropertyType)
  propertyType?: PropertyType;

  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  propertyName?: string;

  @IsOptional()
  @IsEnum(PropertySortOption)
  sort?: PropertySortOption;

  @Transform(({ value }) => Number.parseInt(String(value ?? '1'), 10))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => Number.parseInt(String(value ?? '14'), 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 14;

  @Transform(({ value }) => normalizeArray(value))
  @IsOptional()
  priceRanges?: string[];

  @Transform(({ value }) => normalizeArray(value))
  @IsOptional()
  sqftRanges?: string[];

  @Transform(({ value }) => normalizeArray(value))
  @IsOptional()
  unitType?: string[];

  @Transform(({ value }) => normalizeArray(value))
  @IsOptional()
  furnishing?: string[];

  @Transform(({ value }) => normalizeArray(value))
  @IsOptional()
  floor?: string[];

  @Transform(({ value }) => normalizeArray(value))
  @IsOptional()
  facing?: string[];

  @Transform(({ value }) => normalizeArray(value))
  @IsOptional()
  age?: string[];

  @Transform(({ value }) => normalizeArray(value))
  @IsOptional()
  propertyUse?: string[];
}
