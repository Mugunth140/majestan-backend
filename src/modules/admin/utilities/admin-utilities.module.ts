import { Module } from '@nestjs/common';
import { AdminCommonModule } from '../common/admin-common.module';
import { AdminUtilitiesController } from './admin-utilities.controller';
import { AdminUtilitiesService } from './admin-utilities.service';

@Module({
  imports: [AdminCommonModule],
  controllers: [AdminUtilitiesController],
  providers: [AdminUtilitiesService],
  exports: [AdminUtilitiesService],
})
export class AdminUtilitiesModule {}
