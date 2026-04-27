import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateAdminDto {
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_.-]+$/)
  username!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
