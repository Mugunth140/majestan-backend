import { Transform } from 'class-transformer';
import {
  IsInt,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class ToggleWishlistDto {
  @IsString()
  @MinLength(6)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  guestId!: string;

  @Transform(({ value }) => Number.parseInt(String(value), 10))
  @IsInt()
  @Min(1)
  propertyId!: number;

  @IsString()
  @MinLength(2)
  @MaxLength(64)
  propertyType!: string;
}
