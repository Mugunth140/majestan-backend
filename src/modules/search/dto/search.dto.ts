import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  propertyType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  listingType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @Transform(({ value }) => Number.parseInt(String(value ?? '1'), 10))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => Number.parseInt(String(value ?? '20'), 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
