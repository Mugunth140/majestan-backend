import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { AdLinkType, AdPlacement } from '../../../../database/entities/ad.entity';

export class UpdateAdDto {
  @IsEnum(AdPlacement)
  @IsOptional()
  placement?: AdPlacement;

  @IsString()
  @IsOptional()
  @MaxLength(120)
  title?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  desktopImageKey?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  mobileImageKey?: string;

  @IsEnum(AdLinkType)
  @IsOptional()
  linkType?: AdLinkType;

  @ValidateIf((o) => o.linkType === 'preset')
  @IsString()
  @IsOptional()
  @MaxLength(80)
  linkPreset?: string;

  @ValidateIf((o) => o.linkType === 'custom')
  @IsString()
  @IsOptional()
  @MaxLength(500)
  @Matches(/^\/[^\/\s].*$/, { message: 'linkCustom must be an internal path starting with /' })
  linkCustom?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
