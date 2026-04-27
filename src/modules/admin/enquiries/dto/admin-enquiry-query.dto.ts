import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class AdminEnquiryQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  propertyType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  purchaseType?: string;
}
