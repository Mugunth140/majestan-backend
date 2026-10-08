import { Module } from '@nestjs/common';
import { AdminCommonModule } from '../common/admin-common.module';
import { AdminFurnishingItemsController } from './admin-furnishing-items.controller';
import { AdminFurnishingItemsService } from './admin-furnishing-items.service';

@Module({
  imports: [AdminCommonModule],
  controllers: [AdminFurnishingItemsController],
  providers: [AdminFurnishingItemsService],
  exports: [AdminFurnishingItemsService],
})
export class AdminFurnishingItemsModule {}
