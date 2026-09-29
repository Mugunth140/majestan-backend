import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class OtpLoginRequestDto {
  @IsString() @Matches(/^\+[1-9]\d{1,4}$/) countryCode!: string;
  @IsString() @MinLength(5) @MaxLength(15) @Matches(/^[0-9]+$/) phone!: string;
}
