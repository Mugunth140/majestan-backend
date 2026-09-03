import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ListingType } from '../../../../common/enums/listing-type.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminPropertyQueryDto extends PaginationQueryDto {
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
}
