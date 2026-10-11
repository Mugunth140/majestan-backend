import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateBuilderDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  experienceYears?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  completedProjects?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ongoingProjects?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBuilderDto extends PartialType(CreateBuilderDto) {}
