import { Module } from '@nestjs/common';
import { AdminCitiesController } from './admin-cities.controller';
import { AdminCitiesService } from './admin-cities.service';
import { AdminCommonModule } from '../common/admin-common.module';

@Module({
  imports: [AdminCommonModule],
  controllers: [AdminCitiesController],
  providers: [AdminCitiesService],
})
export class AdminCitiesModule {}
