import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SublocationDataDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  city_id!: number;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  locality_name!: string;

  @Transform(({ value }) => {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postal_code!: string | null;

  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsIn([0, 1])
  is_active = 1;
}

export class UpsertSublocationDto {
  @ValidateNested()
  @Type(() => SublocationDataDto)
  data!: SublocationDataDto;
}
