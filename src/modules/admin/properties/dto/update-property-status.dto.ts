import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PropertyStatus } from '../../../../database/entities/property.entity';

export class UpdatePropertyStatusDto {
  @ApiProperty({ enum: PropertyStatus, enumName: 'PropertyStatus' })
  @IsEnum(PropertyStatus)
  status!: PropertyStatus;
}
