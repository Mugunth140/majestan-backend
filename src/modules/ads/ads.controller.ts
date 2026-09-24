import { Controller, Get, Query } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { AdPlacement } from '../../database/entities/ad.entity';
import { AdsService } from './ads.service';

@Public()
@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get()
  @ApiQuery({ name: 'placement', enum: AdPlacement, required: false })
  list(@Query('placement') placement?: string) {
    const value = Object.values(AdPlacement).includes(placement as AdPlacement)
      ? (placement as AdPlacement)
      : AdPlacement.Hero;
    return this.adsService.listActive(value);
  }
}
