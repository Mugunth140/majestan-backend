import { IsEnum } from 'class-validator';
import { PropertyStatus } from '../../../../database/entities/property.entity';

export class UpdatePropertyStatusDto {
  @IsEnum(PropertyStatus)
  status!: PropertyStatus;
}
