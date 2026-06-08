import { Module } from '@nestjs/common';
import { AdminCommonModule } from '../common/admin-common.module';
import { AdminAmenitiesController } from './admin-amenities.controller';
import { AdminAmenitiesService } from './admin-amenities.service';

@Module({
  imports: [AdminCommonModule],
  controllers: [AdminAmenitiesController],
  providers: [AdminAmenitiesService],
  exports: [AdminAmenitiesService],
})
export class AdminAmenitiesModule {}
