import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class PhoneAuthDto {
  @IsString()
  @MinLength(10)
  @MaxLength(15)
  @Matches(/^[0-9]+$/, { message: 'Phone number must contain only digits' })
  phone!: string;
}