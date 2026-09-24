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
  @ApiProperty({ enum: AdPlacement, enumName: 'AdPlacement', default: AdPlacement.Hero, required: false })
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

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  mobileImageKey!: string;

  @ApiProperty({ enum: AdLinkType, enumName: 'AdLinkType', default: AdLinkType.Preset, required: false })
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
