import { Module } from '@nestjs/common';
import { AdminSublocationsController } from './admin-sublocations.controller';
import { AdminSublocationsService } from './admin-sublocations.service';
import { AdminCommonModule } from '../common/admin-common.module';

@Module({
  imports: [AdminCommonModule],
  controllers: [AdminSublocationsController],
  providers: [AdminSublocationsService],
})
export class AdminSublocationsModule {}
