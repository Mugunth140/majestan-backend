import { IsEnum, IsNumber, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ListingType } from '../../../../common/enums/listing-type.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminPropertyQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: ListingType, enumName: 'ListingType', required: false })
  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;

  // NOTE: base PaginationQueryDto owns `search` (string) and `status` (number
  // active-flag), so the cross-type status filter uses its own param name.
  @IsOptional()
  @IsString()
  statusFilter?: string;

  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cityId?: number;
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minSqft?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxSqft?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minBudget?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxBudget?: number;

  @IsOptional()
  @IsString()
  floor?: string;

  @IsOptional()
  @IsString()
  specialPurpose?: string;

  @IsOptional()
  @IsString()
  furnishingStatus?: string;

  @IsOptional()
  @IsString()
  roadName?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  sublocationId?: number;
}
