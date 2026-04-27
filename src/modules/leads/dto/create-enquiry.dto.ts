import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateEnquiryDto {
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
  purchaseType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  listingType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  budget?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}
