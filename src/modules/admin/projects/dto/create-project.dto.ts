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
import { ProjectAmenityAvailability } from '../../../../database/entities/project-amenity.entity';

class ProjectRoomDimensionDto {
  @IsString() @MaxLength(100) name!: string;
  @IsString() @MaxLength(100) dimensions!: string;
}

class ProjectTowerDetailDto {
  @IsOptional() @IsString() @MaxLength(50) tower?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) floors?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) units?: number;
}

class ProjectSpecificationDto {
  @IsString() @MaxLength(100) label!: string;
  @IsString() @MaxLength(255) value!: string;
}

class ProjectAmenityDto {
  @Type(() => Number) @IsNumber() amenityId!: number;
  @IsOptional() @IsEnum(ProjectAmenityAvailability) availability?: ProjectAmenityAvailability;
  @IsOptional() @IsString() @MaxLength(255) notes?: string;
}

class ProjectConnectivityDto {
  @IsOptional() @IsString() @MaxLength(50) icon?: string;
  @IsOptional() @IsString() @MaxLength(100) label?: string;
  @IsOptional() @IsString() @MaxLength(255) detail?: string;
}

class NearbyPlaceDto {
  @IsOptional() @IsString() @MaxLength(255) name?: string;
  @IsOptional() @IsString() @MaxLength(50) distance?: string;
}

class NearbyCategoryDto {
  @IsOptional() @IsString() @MaxLength(100) title?: string;
  @IsOptional() @IsString() @MaxLength(100) icon?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NearbyPlaceDto) places?: NearbyPlaceDto[];
}

class ProjectFaqDto {
  @IsString() @MaxLength(500) question!: string;
  @IsString() answer!: string;
}

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
  @IsOptional() @Type(() => Number) @IsNumber() udsAreaSqft?: number;
  @IsOptional() @Type(() => Number) @IsNumber() plotAreaSqft?: number;
  @IsOptional() @Type(() => Number) @IsNumber() plotAreaCents?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) parking?: number;
  @IsOptional() @IsString() @MaxLength(20) parkingType?: string;
  @IsOptional() @IsBoolean() unitGuestParking?: boolean;
  @IsOptional() @IsBoolean() poojaRoom?: boolean;
  @IsOptional() @IsBoolean() studyRoom?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) openSides?: number;
  @IsOptional() @IsBoolean() boundaryWall?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectRoomDimensionDto) roomDimensions?: ProjectRoomDimensionDto[];
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
  @IsOptional() @IsArray() @Type(() => Number) @IsInt({ each: true }) furnishingItemIds?: number[];
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
  @IsOptional() @IsString() @MaxLength(255) city!: string;
  @IsOptional() @IsString() @MaxLength(255) state?: string;
  @IsOptional() @IsString() @MaxLength(255) sublocation?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) towers?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalUnits?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalFloors?: number;
  @IsOptional() @Type(() => Number) @IsNumber() projectAreaSqft?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectTowerDetailDto) towerDetails?: ProjectTowerDetailDto[];
  @IsOptional() @IsString() @MaxLength(20) pincode?: string;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsString() highlights?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectSpecificationDto) specifications?: ProjectSpecificationDto[];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(1024) coverImageUrl?: string;
  @IsOptional() @IsArray() galleryImageUrls?: string[];
  @IsOptional() @IsString() @MaxLength(1024) brochureKey?: string;
  @IsOptional() @IsString() @MaxLength(255) brochureName?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectConnectivityDto) connectivity?: ProjectConnectivityDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NearbyCategoryDto) nearbyCategories?: NearbyCategoryDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectFaqDto) faqs?: ProjectFaqDto[];
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', required: false })
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateProjectUnitDto) units?: CreateProjectUnitDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectAmenityDto) amenities?: ProjectAmenityDto[];
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
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) totalFloors?: number;
  @IsOptional() @Type(() => Number) @IsNumber() projectAreaSqft?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectTowerDetailDto) towerDetails?: ProjectTowerDetailDto[];
  @IsOptional() @IsString() @MaxLength(20) pincode?: string;
  @IsOptional() @Type(() => Number) @IsNumber() latitude?: number;
  @IsOptional() @Type(() => Number) @IsNumber() longitude?: number;
  @IsOptional() @IsString() highlights?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectSpecificationDto) specifications?: ProjectSpecificationDto[];
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() @MaxLength(1024) coverImageUrl?: string;
  @IsOptional() @IsArray() galleryImageUrls?: string[];
  @IsOptional() @IsString() @MaxLength(1024) brochureKey?: string;
  @IsOptional() @IsString() @MaxLength(255) brochureName?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectConnectivityDto) connectivity?: ProjectConnectivityDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NearbyCategoryDto) nearbyCategories?: NearbyCategoryDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectFaqDto) faqs?: ProjectFaqDto[];
  @ApiProperty({ enum: ProjectStatus, enumName: 'ProjectStatus', required: false })
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateProjectUnitDto) units?: CreateProjectUnitDto[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ProjectAmenityDto) amenities?: ProjectAmenityDto[];
}
