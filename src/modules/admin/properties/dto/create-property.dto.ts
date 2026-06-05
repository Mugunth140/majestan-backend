import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { PropertyType, PropertyStatus } from '../../../../database/entities/property.entity';

class PropertyDetailsDto {
  @IsOptional() @IsNumber() bedroomCount?: number;
  @IsOptional() @IsNumber() bathroomCount?: number;
  @IsOptional() @IsNumber() balconyCount?: number;
  @IsOptional() @IsNumber() totalFloors?: number;
  @IsOptional() @IsNumber() buildUpArea?: number;
  @IsOptional() @IsNumber() carpetArea?: number;
  @IsOptional() @IsString() facing?: string;
  @IsOptional() @IsString() furnishStatus?: string;
  @IsOptional() @IsString() completionStatus?: string;
  @IsOptional() @IsString() ageOfProperty?: string;
  @IsOptional() @IsString() ownershipType?: string;
}

class PropertyLocationDto {
  @IsString() address!: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() mapUrl?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;
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
}

class PropertyFileDto {
  @IsString() fileType!: string; // BROCHURE, LEGAL_DOC, etc.
  @IsString() fileUrl!: string;
  @IsOptional() @IsString() title?: string;
}

class PropertyFaqDto {
  @IsString() question!: string;
  @IsString() answer!: string;
}

export class CreatePropertyDto {
  @IsOptional() @IsString() propertyCode?: string;
  @IsString() title!: string;
  @IsString() description!: string;
  @IsString() price!: string;
  
  @IsEnum(PropertyType)
  propertyType!: PropertyType;
  
  @IsEnum(PropertyStatus)
  status!: PropertyStatus;
  
  @IsString() city!: string;
  @IsString() state!: string;
  @IsString() country!: string;
  
  @IsNumber() ownerId!: number;

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
