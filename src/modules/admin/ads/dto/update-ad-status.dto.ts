import { IsBoolean } from 'class-validator';

export class UpdateAdStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
