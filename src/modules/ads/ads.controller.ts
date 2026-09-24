import { Controller, Get, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { AdPlacement } from '../../database/entities/ad.entity';
import { AdsService } from './ads.service';

@Public()
@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get()
  list(@Query('placement') placement?: AdPlacement) {
    const value = Object.values(AdPlacement).includes(placement as AdPlacement)
      ? (placement as AdPlacement)
      : AdPlacement.Hero;
    return this.adsService.listActive(value);
  }
}
