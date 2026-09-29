import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class OtpRegisterRequestDto {
  @IsString() @MinLength(2) @MaxLength(120) name!: string;
  @IsEmail() @MaxLength(255) email!: string;
  @IsString() @Matches(/^\+[1-9]\d{0,4}$/) countryCode!: string;
  @IsString() @MinLength(5) @MaxLength(15) @Matches(/^[0-9]+$/) phone!: string;
}
