import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ProjectSearchQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsIn(['apartment', 'villa'])
  projectType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bhk?: number;

  @IsOptional()
  @Type(() => Number)
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  maxPrice?: number;

  @IsOptional()
  @IsIn(['under_construction', 'ready_to_move'])
  possession?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  rera?: boolean;

  @Transform(({ value }) => Number.parseInt(String(value ?? '1'), 10))
  @IsInt()
  @Min(1)
  page = 1;

  @Transform(({ value }) => Number.parseInt(String(value ?? '12'), 10))
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 12;
}
