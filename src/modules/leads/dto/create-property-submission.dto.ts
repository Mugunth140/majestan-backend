import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreatePropertySubmissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @MinLength(6)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  propertyType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  listingType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  location?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
