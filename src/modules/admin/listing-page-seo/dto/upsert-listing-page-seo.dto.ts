import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertListingPageSeoDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  pageKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  metaTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  metaDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  h1?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  ogTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(320)
  ogDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  ogImageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  robotsIndex?: boolean;

  @IsOptional()
  @IsBoolean()
  robotsFollow?: boolean;

  @IsOptional()
  @IsString()
  customContent?: string | null;
}
