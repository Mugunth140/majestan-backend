import { InventoryInsightsController } from './inventory/inventory.controller';
import { InventoryInsightsService } from './inventory/inventory-insights.service';
import { Module } from '@nestjs/common';
import {
  AnalyticsReadGuard,
  SiteAnalyticsController,
} from './analytics.controller';
import { SiteAnalyticsStore } from './analytics-store.service';

@Module({
  controllers: [SiteAnalyticsController, InventoryInsightsController],
  providers: [SiteAnalyticsStore, AnalyticsReadGuard, InventoryInsightsService],
})
export class SiteAnalyticsModule {}
