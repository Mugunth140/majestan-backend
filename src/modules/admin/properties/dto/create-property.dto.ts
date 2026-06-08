import { IsString, IsNumber, IsOptional, IsEnum, IsArray, ValidateNested, IsBoolean } from 'class-validator';
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
}

class PropertyLocationDto {
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() subLocation?: string;
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
  @IsOptional() @IsString() slug?: string;
  @IsString() title!: string;
  @IsString() description!: string;
  @IsString() price!: string;
  @IsOptional() @IsString() builderName?: string;
  
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
