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

  // ── CRM-only operational fields ──
  @IsOptional() @IsNumber() udsArea?: number;
  @IsOptional() @IsString() unitNumber?: string;
  @IsOptional() @IsString() unitType?: string;
  @IsOptional() @IsNumber() numberOfFlats?: number;
  @IsOptional() @IsNumber() towerNos?: number;
  @IsOptional() @IsBoolean() poojaRoom?: boolean;
  @IsOptional() @IsBoolean() studyRoom?: boolean;
  @IsOptional() @IsString() architecturalStyle?: string;
  @IsOptional() @IsString() availablePortion?: string;
  @IsOptional() @IsString() amenities?: string;
  @IsOptional() @IsNumber() plotNos?: number;
  @IsOptional() @IsString() zoning?: string;
  @IsOptional() @IsString() plotType?: string;
  @IsOptional() @IsString() landType?: string;
  @IsOptional() @IsString() topography?: string;
  @IsOptional() @IsString() soilType?: string;
  @IsOptional() @IsString() irrigation?: string;
  @IsOptional() @IsString() fencing?: string;
  @IsOptional() @IsString() cropSuitability?: string;
  @IsOptional() @IsString() existingPlantation?: string;
  @IsOptional() @IsBoolean() boreWell?: boolean;
  @IsOptional() @IsBoolean() storageTank?: boolean;
  @IsOptional() @IsString() waterSources?: string;
  @IsOptional() @IsString() sfNumber?: string;
  @IsOptional() @IsString() propertyUse?: string;
  @IsOptional() @IsNumber() noOfLifts?: number;
  @IsOptional() @IsString() dimension?: string;
  @IsOptional() @IsString() frontage?: string;
  @IsOptional() @IsBoolean() outsideParking?: boolean;
  @IsOptional() @IsString() visitorsParking?: string;
  @IsOptional() @IsBoolean() fireSafety?: boolean;
  @IsOptional() @IsString() electricityConnection?: string;
  @IsOptional() @IsNumber() conferenceRoom?: number;
  @IsOptional() @IsNumber() seater?: number;
  @IsOptional() @IsString() tenantMix?: string;
  @IsOptional() @IsString() buildingType?: string;
  @IsOptional() @IsNumber() numberOfBays?: number;
  @IsOptional() @IsNumber() numberOfCabins?: number;
  @IsOptional() @IsNumber() loadingBays?: number;
  @IsOptional() @IsNumber() warehouseRacks?: number;
  @IsOptional() @IsBoolean() truckTrailerAccess?: boolean;
  @IsOptional() @IsBoolean() craneAvailable?: boolean;
  @IsOptional() @IsString() workerFacilities?: string;
  @IsOptional() @IsString() nearestHighway?: string;
  @IsOptional() @IsString() nearestRailway?: string;
  @IsOptional() @IsString() nearestPort?: string;
  @IsOptional() @IsString() nearestAirport?: string;
  @IsOptional() @IsString() labourAvailability?: string;
  @IsOptional() @IsNumber() advanceRent?: number;
  @IsOptional() @IsString() leaseTerm?: string;
  @IsOptional() @IsString() incrementalRent?: string;
  @IsOptional() @IsString() electricityCharges?: string;
  @IsOptional() @IsBoolean() highSpeedWifi?: boolean;
  @IsOptional() @IsBoolean() airConditioning?: boolean;
  @IsOptional() @IsBoolean() cctvSurveillance?: boolean;
  @IsOptional() @IsBoolean() elevatorAccess?: boolean;
  @IsOptional() @IsBoolean() securityStaff?: boolean;
  @IsOptional() @IsString() furnitureProvided?: string;
  @IsOptional() @IsString() outdoorSpaces?: string;
  @IsOptional() @IsString() utilitiesProvided?: string;
  @IsOptional() @IsString() neighborhoodHighlights?: string;
  @IsOptional() @IsString() communityFacilities?: string;
  @IsOptional() @IsString() accessibility?: string;
  @IsOptional() @IsString() furnishingStatus?: string;
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
  @IsOptional() @IsString() answer!: string;
  @IsOptional() @IsString() section?: string;
}

class PropertyDocumentDto {
  @IsString() fileKey!: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsNumber() fileSizeBytes?: number;
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsBoolean() isPublic?: boolean;
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

  // ── CRM-only operational fields ──
  @IsOptional() @IsString() alternateName?: string;
  @IsOptional() @IsString() alternatePhone?: string;
  @IsOptional() @IsString() alternateEmail?: string;
  @IsOptional() @IsString() transactionType?: string;
  @IsOptional() @IsString() handoverDate?: string;
  @IsOptional() @IsString() roadName?: string;
  @IsOptional() @IsString() roadAccess?: string;
  @IsOptional() @IsString() tenantOccupied?: string;
  @IsOptional() @IsString() saleType?: string;
  @IsOptional() @IsString() agentName?: string;
  @IsOptional() @IsString() agencyName?: string;
  @IsOptional() @IsString() commissionTerms?: string;
  @IsOptional() @IsString() expectedSalePrice?: string;
  @IsOptional() @IsString() monthlyRent?: string;
  @IsOptional() @IsString() lockInPeriod?: string;
  @IsOptional() @IsString() taxes?: string;
  @IsOptional() @IsString() registrationCharge?: string;
  @IsOptional() @IsString() modeOfPayment?: string;
  @IsOptional() @IsString() timeForRegistration?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() demandArea?: string;
  @IsOptional() @IsString() rentalYield?: string;
  @IsOptional() @IsString() comparativePrice?: string;
  @IsOptional() @IsString() marketPrice?: string;
  @IsOptional() @IsString() ownershipTitleVerified?: string;
  @IsOptional() @IsString() encumbranceCertificate?: string;
  @IsOptional() @IsString() rentalAgreementDraft?: string;
  @IsOptional() @IsString() tslrFmb?: string;
  @IsOptional() @IsString() taxReceipt?: string;
  @IsOptional() @IsString() ebReceipt?: string;
  @IsOptional() @IsString() pattaChitta?: string;
  @IsOptional() @IsString() approvals?: string;
  @IsOptional() @IsString() financeFacing?: string;
  @IsOptional() @IsString() hypothecation?: string;
  @IsOptional() @IsString() deviation?: string;
  @IsOptional() @IsString() attachment1?: string;
  @IsOptional() @IsString() attachment2?: string;
  @IsOptional() @IsString() attachment3?: string;
  @IsOptional() @IsString() attachment4?: string;
  @IsOptional() @IsString() attachment5?: string;
  @IsOptional() @IsString() attachment6?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropertyDocumentDto)
  documents?: PropertyDocumentDto[];
}
