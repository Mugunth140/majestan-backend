import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdLinkType, AdPlacement } from '../../../../database/entities/ad.entity';

export class CreateAdDto {
  @ApiProperty({ enum: AdPlacement, enumName: 'AdPlacement', default: 'hero', required: false })
  @IsEnum(AdPlacement)
  @IsOptional()
  placement?: AdPlacement = AdPlacement.Hero;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  desktopImageKey!: string;

  // Required only where the placement spec says so (checked in the service).
  @IsString()
  @IsOptional()
  @MaxLength(500)
  mobileImageKey?: string;

  // Audience targeting (e.g. buy / rent / services); empty = all / fallback.
  @ValidateIf((o) => o.audience !== null && o.audience !== '')
  @IsString()
  @IsOptional()
  @MaxLength(20)
  audience?: string | null;

  @ApiProperty({ enum: AdLinkType, enumName: 'AdLinkType', default: 'preset', required: false })
  @IsEnum(AdLinkType)
  @IsOptional()
  linkType?: AdLinkType = AdLinkType.Preset;

  @ValidateIf((o) => o.linkType === 'preset' || o.linkType === undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  linkPreset?: string;

  @ValidateIf((o) => o.linkType === 'custom')
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Matches(/^\/[^\/\s].*$/, { message: 'linkCustom must be an internal path starting with /' })
  linkCustom?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number = 0;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  createdBy?: string;
}
