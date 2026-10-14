import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  Max,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PickType } from '@nestjs/swagger';
import {
  CreatePropertyDto,
  PropertyDetailsDto,
  PropertyLocationDto,
} from '../../admin/properties/dto/create-property.dto';

// Reuse staff field definitions without exposing staff verification/legal controls.
export class OwnerDetailsDto extends PickType(PropertyDetailsDto, [
  'areaSqft',
  'bedrooms',
  'bathrooms',
  'balconies',
  'carpetArea',
  'buildUpArea',
  'superBuiltUpArea',
  'plotArea',
  'areaUnit',
  'floorNumber',
  'totalFloors',
  'facing',
  'furnishingStatus',
  'propertyAge',
  'possessionStatus',
  'parking',
  'parkingType',
  'waterSupply',
  'poojaRoom',
  'studyRoom',
  'powerBackup',
  'plotSizeCents',
  'plotLength',
  'plotWidth',
  'roadWidth',
  'boundaryWall',
  'landType',
  'soilType',
  'waterSources',
  'existingPlantation',
  'fencing',
  'boreWell',
  'propertyUse',
  'noOfLifts',
  'sharedWashrooms',
  'individualWashrooms',
  'hasPantry',
  'fireSafety',
  'ceilingHeightFt',
  'coveredArea',
  'openArea',
  'powerSupplyHp',
  'truckParking',
  'heavyVehicleAccess',
  'craneAvailable',
  'availableWorkstations',
  'minSeats',
  'privateCabins',
  'meetingRooms',
  'rentPerSeat',
  'highSpeedWifi',
  'airConditioning',
  'hasRestroom',
  'unitType',
  'furnished',
] as const) {}
class OwnerLocationDto extends PickType(PropertyLocationDto, [
  'address',
  'pincode',
] as const) {
  @IsString() @IsNotEmpty() @MaxLength(1000) address!: string;
  @IsOptional() @Matches(/^\d{6}$/) pincode?: string;
}
class OwnerPhotoDto {
  @IsString()
  @MaxLength(512)
  @Matches(/^(uploads|local)\/temp\/[A-Za-z0-9._-]+$/)
  fileKey!: string;
}
class OwnerFloorPlanDto {
  @IsString()
  @MaxLength(512)
  @Matches(/^(uploads|local)\/temp\/[A-Za-z0-9._-]+$/)
  fileKey!: string;

  @IsOptional() @IsString() @MaxLength(255) fileName?: string;
  @IsOptional()
  @IsIn(['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  mimeType?: string;
  @IsOptional() @IsInt() @Min(1) @Max(15 * 1024 * 1024) fileSizeBytes?: number;
}
class OwnerAmenityDto {
  @IsInt() @Min(1) amenityId!: number;
}
class OwnerFurnishingDto {
  @IsInt() @Min(1) furnishingItemId!: number;
}

export class SubmitOwnerPropertyDto extends PickType(CreatePropertyDto, [
  'projectName',
  'ownershipType',
  'transactionType',
  'negotiable',
  'maintenanceCharges',
  'securityDeposit',
  'bookingAmount',
  'availableFrom',
  'lockInPeriod',
] as const) {
  @IsString() @IsNotEmpty() @MaxLength(150) title!: string;
  @IsString() @IsNotEmpty() @MaxLength(5000) description!: string;
  @IsString() @Matches(/^\d{1,10}(\.\d{1,2})?$/) price!: string;
  @IsIn(['Sell', 'Rent']) listingType!: 'Sell' | 'Rent';
  @IsInt() @Min(1) cityId!: number;
  @IsInt() @Min(1) sublocationId!: number;
  @IsOptional() @IsString() @MaxLength(255) reraNumber?: string;
  @ValidateNested() @Type(() => OwnerDetailsDto) details!: OwnerDetailsDto;
  @ValidateNested() @Type(() => OwnerLocationDto) location!: OwnerLocationDto;
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique((photo: OwnerPhotoDto) => photo.fileKey)
  @ValidateNested({ each: true })
  @Type(() => OwnerPhotoDto)
  files?: OwnerPhotoDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ArrayUnique((plan: OwnerFloorPlanDto) => plan.fileKey)
  @ValidateNested({ each: true })
  @Type(() => OwnerFloorPlanDto)
  floorPlans?: OwnerFloorPlanDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique((a: OwnerAmenityDto) => a.amenityId)
  @ValidateNested({ each: true })
  @Type(() => OwnerAmenityDto)
  amenities?: OwnerAmenityDto[];
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique((f: OwnerFurnishingDto) => f.furnishingItemId)
  @ValidateNested({ each: true })
  @Type(() => OwnerFurnishingDto)
  furnishingItems?: OwnerFurnishingDto[];
}
