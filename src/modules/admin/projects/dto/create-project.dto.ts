import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  FacingDirection,
  FurnishedStatus,
  ListingMode,
  PropertyUnitStatus,
  PropertyUnitType,
} from '../../../../database/entities/property-unit.entity';
import {
  PossessionStatus,
  ProjectStatus,
  ProjectType,
} from '../../../../database/entities/project.entity';

export class CreateProjectUnitDto {
  @IsString()
  @MaxLength(64)
  unitCode!: string;

  @IsOptional() @IsString() @MaxLength(150) title?: string;
  @ApiProperty({ enum: PropertyUnitType, enumName: 'PropertyUnitType', required: false })
  @IsOptional() @IsEnum(PropertyUnitType) unitType?: PropertyUnitType;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bedrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) bathrooms?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) balconies?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) floorNo?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalFloors?: number;
  @IsOptional() @Type(() => Number) @IsNumber() carpetAreaSqft?: number;
  @IsOptional() @Type(() => Number) @IsNumber() builtupAreaSqft?: number;
  @IsOptional() @Type(() => Number) @IsNumber() superBuiltupAreaSqft?: number;
  @ApiProperty({ enum: FurnishedStatus, enumName: 'FurnishedStatus', required: false })
  @IsOptional() @IsEnum(FurnishedStatus) furnishedStatus?: FurnishedStatus;
  @ApiProperty({ enum: FacingDirection, enumName: 'FacingDirection', required: false })
  @IsOptional() @IsEnum(FacingDirection) facing?: FacingDirection;
  @ApiProperty({ enum: ListingMode, enumName: 'ListingMode', required: false })
  @IsOptional() @IsEnum(ListingMode) listingMode?: ListingMode;
  @IsOptional() @Type(() => Number) @IsNumber() price?: number;
  @IsOptional() @Type(() => Number) @IsNumber() monthlyRent?: number;
  @IsOptional() @Type(() => Number) @IsNumber() securityDeposit?: number;
  @IsOptional() @Type(() => Number) @IsNumber() maintenanceFee?: number;
  @IsOptional() @IsDateString() availableFrom?: string;
  @ApiProperty({ enum: PropertyUnitStatus, enumName: 'PropertyUnitStatus', required: false })
  @IsOptional() @IsEnum(PropertyUnitStatus) status?: PropertyUnitStatus;
  @IsOptional() @IsString() @MaxLength(1024) floorPlanImageUrl?: string;
  @IsOptional() @IsString() @MaxLength(1024) floorPlanImageKey?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}

export class CreateProjectDto {
  @IsString() @MaxLength(255) name!: string;
  @IsOptional() @IsString() @MaxLength(512) slug?: string;
  @ApiProperty({ enum: ProjectType, enumName: 'ProjectType' })
  @IsEnum(ProjectType) projectType!: ProjectType;
  @IsOptional() @IsString() @MaxLength(255) builderName?: string;
  @IsOptional() @IsString() @MaxLength(100) reraNumber?: string;
  @IsOptional() @IsDateString() possessionDate?: string;
  @ApiProperty({ enum: PossessionStatus, enumName: 'PossessionStatus', required: false })
  @IsOptional() @IsEnum(PossessionStatus) possessionStatus?: PossessionStatus;
  @IsString() @MaxLength(255) city!: string;
  @IsOptional() @IsString() @MaxLength(255) state?: string;
  @IsOptional() @IsString() @MaxLength(255) sublocation?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) towers?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalUnits?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(1024) coverImageUrl?: string;
  @IsOptional() @IsArray() galleryImageUrls?: string[];
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', required: false })
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateProjectUnitDto) units?: CreateProjectUnitDto[];
}

export class UpdateProjectDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(512) slug?: string;
  @ApiProperty({ enum: ProjectType, enumName: 'ProjectType', required: false })
  @IsOptional() @IsEnum(ProjectType) projectType?: ProjectType;
  @IsOptional() @IsString() @MaxLength(255) builderName?: string;
  @IsOptional() @IsString() @MaxLength(100) reraNumber?: string;
  @IsOptional() @IsDateString() possessionDate?: string;
  @ApiProperty({ enum: PossessionStatus, enumName: 'PossessionStatus', required: false })
  @IsOptional() @IsEnum(PossessionStatus) possessionStatus?: PossessionStatus;
  @IsOptional() @IsString() @MaxLength(255) city?: string;
  @IsOptional() @IsString() @MaxLength(255) state?: string;
  @IsOptional() @IsString() @MaxLength(255) sublocation?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) towers?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalUnits?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(1024) coverImageUrl?: string;
  @IsOptional() @IsArray() galleryImageUrls?: string[];
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', required: false })
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateProjectUnitDto) units?: CreateProjectUnitDto[];
}
