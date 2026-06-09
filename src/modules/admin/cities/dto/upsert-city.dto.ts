import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class CityDataDto {
  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  city_name!: string;

  @Transform(({ value }) => String(value).trim())
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  state_name!: string;

  @Transform(({ value }) => String(value ?? 'India').trim())
  @IsString()
  @IsIn(['India'])
  country_name = 'India';

  @Transform(({ value }) => String(value ?? 'IN').trim().toUpperCase())
  @IsString()
  @Length(2, 2)
  @IsIn(['IN'])
  country_code = 'IN';

  @Transform(({ value }) => Number(value))
  @IsInt()
  @IsIn([0, 1])
  is_active = 1;
}

export class UpsertCityDto {
  @ValidateNested()
  @Type(() => CityDataDto)
  data!: CityDataDto;
}
