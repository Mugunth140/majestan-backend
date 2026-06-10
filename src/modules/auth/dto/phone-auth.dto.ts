import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class PhoneAuthDto {
  @IsString()
  @Matches(/^\+[1-9]\d{1,4}$/, { message: 'Invalid country code (e.g., +91)' })
  countryCode!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(15)
  @Matches(/^[0-9]+$/, { message: 'Phone number must contain only digits' })
  phone!: string;

  // Modular fields for future expansion
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}