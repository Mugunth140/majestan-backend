import {
  Controller,
  Get,
  Header,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Public } from '../../../common/decorators/public.decorator';
import { AnalyticsReadGuard } from '../analytics.controller';
import { InventoryInsightsService } from './inventory-insights.service';
@Public()
@Controller('analytics/property-insights/v2')
@UseGuards(AnalyticsReadGuard)
export class InventoryInsightsController {
  constructor(private readonly insights: InventoryInsightsService) {}
  @Header('Cache-Control', 'no-store') @Get('report') report(
    @Query() query: Record<string, unknown>,
  ) {
    return this.insights.report(query);
  }
  @Header('Cache-Control', 'no-store') @Get('records') records(
    @Query() query: Record<string, unknown>,
  ) {
    return this.insights.recordsPage(query);
  }
  @Header('Cache-Control', 'no-store') @Get('options') options(
    @Query() query: Record<string, unknown>,
  ) {
    return this.insights.options(query);
  }
  @Header('Cache-Control', 'no-store') @Get('listing') listing(
    @Query('listing') key: string,
    @Query() query: Record<string, unknown>,
  ) {
    const filters = { ...query };
    delete filters.listing;
    return this.insights.detail(key, filters);
  }
  @Header('Cache-Control', 'no-store') @Get('compare') compare(
    @Query('keys') keys: string,
    @Query() query: Record<string, unknown>,
  ) {
    const filters = { ...query };
    delete filters.keys;
    return this.insights.compare(
      typeof keys === 'string' ? keys.split(',') : [],
      filters,
    );
  }
  @Header('Cache-Control', 'no-store') @Get('export') export(
    @Query() query: Record<string, unknown>,
  ) {
    return this.insights.exportRecords(query);
  }
  @Post('refresh') async refresh() {
    await this.insights.refresh(true);
    return { refreshed: true };
  }
}
