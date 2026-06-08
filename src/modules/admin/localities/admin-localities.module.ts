import { Module } from '@nestjs/common';
import { AdminCommonModule } from '../common/admin-common.module';
import { AdminLocalitiesController } from './admin-localities.controller';
import { AdminLocalitiesService } from './admin-localities.service';

@Module({
  imports: [AdminCommonModule],
  controllers: [AdminLocalitiesController],
  providers: [AdminLocalitiesService],
  exports: [AdminLocalitiesService],
})
export class AdminLocalitiesModule {}
