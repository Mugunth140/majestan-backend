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
import { ApiProperty } from '@nestjs/swagger';
import { ListingType } from '../../../common/enums/listing-type.enum';
import { normalizeArray } from '../../../common/utils/normalize-array.util';

export enum PropertySortOption {
  PriceLowToHigh = 'low_to_high',
  PriceHighToLow = 'high_to_low',
  AreaLowToHigh = 'Area_low_to_high',
  AreaHighToLow = 'Area_high_to_low',
}

export class PropertySearchQueryDto {
  /**
   * Accepts both DB enum values ('commercial', 'industrial', 'individual_portion')
   * and API alias values ('commercial-space', 'industrial-space', 'independent-house').
   * Normalization to DB values happens in the service layer.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  propertyType?: string;

  @ApiProperty({ enum: ListingType, enumName: 'ListingType', required: false })
  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  propertyName?: string;

  @ApiProperty({ enum: PropertySortOption, enumName: 'PropertySortOption', required: false })
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

  // Singular filter params sent by the site listing UI (price/area ranges,
  // bedroom count, property age bucket). Kept separate from the array-style
  // params above so both API styles validate instead of 400ing.
  @IsOptional()
  @IsString()
  @MaxLength(32)
  minPrice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  maxPrice?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  minArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  maxArea?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
  bedrooms?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  propertyAge?: string;
}
