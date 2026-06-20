import { IsString, IsNumber, IsOptional, IsObject, IsEnum, IsArray, ValidateNested, IsBoolean, IsInt, Min, IsNotEmpty, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType, PropertyStatus } from '../../../../database/entities/property.entity';

class PropertyDetailsDto {
  @IsOptional() @IsNumber() bedrooms?: number;
  @IsOptional() @IsNumber() bathrooms?: number;
  @IsOptional() @IsNumber() parking?: number;
  @IsOptional() @IsNumber() areaSqft?: number;
  @IsOptional() @IsBoolean() furnished?: boolean;
  @IsOptional() @IsString() facing?: string;
  @IsOptional() @IsNumber() buildUpArea?: number;
  @IsOptional() @IsNumber() carpetArea?: number;
  @IsOptional() @IsNumber() totalFloors?: number;
  @IsOptional() @IsNumber() balconies?: number;
  @IsOptional() @IsString() floorNumber?: string;
  @IsOptional() @IsNumber() superBuiltUpArea?: number;
  @IsOptional() @IsNumber() plotArea?: number;
  @IsOptional() @IsString() areaUnit?: string;
  @IsOptional() @IsString() propertyAge?: string;
  @IsOptional() @IsString() possessionStatus?: string;
  @IsOptional() @IsString() waterSupply?: string;
  @IsOptional() @IsBoolean() powerBackup?: boolean;
  @IsOptional() @IsString() roadWidth?: string;
  @IsOptional() @IsNumber() openSides?: number;
  @IsOptional() @IsNumber() plotLength?: number;
  @IsOptional() @IsNumber() plotWidth?: number;
  @IsOptional() @IsBoolean() boundaryWall?: boolean;
  @IsOptional() @IsString() suitableFor?: string;
  @IsOptional() @IsBoolean() hasPantry?: boolean;
  @IsOptional() @IsBoolean() hasCentralAc?: boolean;
  @IsOptional() @IsNumber() ceilingHeightFt?: number;
  @IsOptional() @IsBoolean() heavyVehicleAccess?: boolean;

  // Plot
  @IsOptional() @IsNumber() plotSizeCents?: number;

  // Coworking
  @IsOptional() @IsNumber() minSeats?: number;
  @IsOptional() @IsNumber() rentPerSeat?: number;
  @IsOptional() @IsNumber() privateCabins?: number;
  @IsOptional() @IsNumber() meetingRooms?: number;
  @IsOptional() @IsNumber() availableWorkstations?: number;
  @IsOptional() @IsBoolean() hasRestroom?: boolean;

  // Commercial
  @IsOptional() @IsArray() floorsOccupied?: string[];

  // Industrial
  @IsOptional() @IsNumber() truckParking?: number;
  @IsOptional() @IsNumber() carParking?: number;
  @IsOptional() @IsNumber() bikeParking?: number;
  @IsOptional() @IsNumber() coveredArea?: number;
  @IsOptional() @IsNumber() openArea?: number;
  @IsOptional() @IsString() floorType?: string;
  @IsOptional() @IsNumber() powerSupplyHp?: number;

  // Apartment
  @IsOptional() @IsBoolean() guestParking?: boolean;

  // Floor Plans & Rooms
  @IsOptional() @IsArray() roomDimensions?: any[];
  @IsOptional() @IsArray() floorPlanImages?: any[];
}

class PropertyLocationDto {
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() subLocation?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() mapUrl?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
  @IsOptional() @IsObject() localityData?: any;
}

class PropertyAmenityDto {
  @IsNumber() amenityId!: number;
  @IsOptional() @IsString() details?: string;
}

class PropertyUnitDto {
  @IsString() unitType!: string; // 1BHK, 2BHK, etc.
  @IsString() title!: string;
  @IsOptional() @IsNumber() sizeSqft?: number;
  @IsOptional() @IsString() price?: string;
  @IsOptional() @IsString() floorPlanImageUrl?: string;
  @IsOptional() @IsString() floorPlanImageKey?: string;
}

class PropertyFileDto {
  @IsString() fileType!: string; // BROCHURE, LEGAL_DOC, etc.
  @IsString() fileUrl!: string;
  @IsOptional() @IsString() fileKey?: string; // R2 object key (separate from public URL)
  @IsOptional() @IsString() title?: string;
}

class PropertyFaqDto {
  @IsString() question!: string;
  @IsString() answer!: string;
  @IsOptional() @IsString() section?: string;
}

export class CreatePropertyDto {
  @IsOptional() @IsString() propertyCode?: string;
  @IsOptional() @IsString() slug?: string;
  @IsString() title!: string;
  @IsString() description!: string;
  @IsString() price!: string;
  @IsOptional() @IsIn(['Sell', 'Rent']) listingType?: 'Sell' | 'Rent';
  @IsOptional() @IsString() builderName?: string;
  
  @IsOptional() @IsString() propertyCondition?: string;
  @IsOptional() @IsString() ownershipType?: string;
  @IsString() @IsNotEmpty() reraNumber!: string;
  @IsOptional() @IsString() projectName?: string;
  
  @IsOptional() @IsString() metaTitle?: string;
  @IsOptional() @IsString() metaDescription?: string;
  @IsOptional() @IsString() metaKeywords?: string;

  @IsOptional() @IsString() brokerageType?: string;
  @IsOptional() @IsString() brokerageValue?: string;

  @IsOptional() @IsString() ownerName?: string;
  @IsOptional() @IsString() ownerEmail?: string;
  @IsOptional() @IsString() ownerPhone?: string;

  @IsOptional() @IsBoolean() negotiable?: boolean;
  @IsOptional() @IsString() maintenanceCharges?: string;
  @IsOptional() @IsString() securityDeposit?: string;
  @IsOptional() @IsString() bookingAmount?: string;
  
  @IsOptional() @IsString() availableFrom?: string;
  @IsOptional() @IsString() availableUntil?: string;
  @IsOptional() @IsString() verificationStatus?: string;
  @IsOptional() @IsString() approvalStatus?: string;

  @IsEnum(PropertyType)
  propertyType!: PropertyType;
  
  @IsEnum(PropertyStatus)
  status!: PropertyStatus;
  
  @IsString() city!: string;
  @IsString() state!: string;
  @IsString() country!: string;

  @IsOptional() @IsInt() @Min(1) cityId?: number;
  @IsOptional() @IsInt() @Min(1) sublocationId?: number;
  
  @IsOptional() @IsNumber() ownerId?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyDetailsDto)
  details?: PropertyDetailsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PropertyLocationDto)
  location?: PropertyLocationDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyAmenityDto)
  amenities?: PropertyAmenityDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyUnitDto)
  units?: PropertyUnitDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyFileDto)
  files?: PropertyFileDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyFaqDto)
  faqs?: PropertyFaqDto[];
}
