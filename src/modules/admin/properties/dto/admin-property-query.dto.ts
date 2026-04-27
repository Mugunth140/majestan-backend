import { IsEnum, IsOptional } from 'class-validator';
import { ListingType } from '../../../../common/enums/listing-type.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminPropertyQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(ListingType)
  listingType?: ListingType;
}
