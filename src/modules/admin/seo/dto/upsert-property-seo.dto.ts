import { IsString, IsOptional, IsIn, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const ROBOTS_VALUES = ['index,follow', 'noindex,follow', 'noindex,nofollow'] as const;

export class SeoPageDataDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() h1?: string;
  @IsOptional() @IsString() og_title?: string;
  @IsOptional() @IsString() og_description?: string;
  @IsOptional() @IsString() og_image?: string;
  @IsOptional() @IsIn(ROBOTS_VALUES) robots?: string;
  // Locality content fields
  @IsOptional() @IsString() content_overview?: string;
  @IsOptional() @IsString() content_connectivity?: string;
  @IsOptional() @IsString() content_education?: string;
  @IsOptional() @IsString() content_healthcare?: string;
  @IsOptional() @IsString() content_shopping?: string;
}

export class UpsertPropertySeoDto {
  @IsOptional() @ValidateNested() @Type(() => SeoPageDataDto) overview?: SeoPageDataDto;
  @IsOptional() @ValidateNested() @Type(() => SeoPageDataDto) amenities?: SeoPageDataDto;
  @IsOptional() @ValidateNested() @Type(() => SeoPageDataDto) floor_plan?: SeoPageDataDto;
  @IsOptional() @ValidateNested() @Type(() => SeoPageDataDto) locality?: SeoPageDataDto;
  @IsOptional() @ValidateNested() @Type(() => SeoPageDataDto) photos?: SeoPageDataDto;
  // Publish fields
  @IsOptional() @IsString() verificationStatus?: string;
  @IsOptional() @IsString() approvalStatus?: string;
}
