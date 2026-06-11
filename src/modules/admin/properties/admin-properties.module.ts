import { Module } from '@nestjs/common';
import { AdminPropertiesController } from './admin-properties.controller';
import { AdminPropertiesService } from './admin-properties.service';
import { AdminCommonModule } from '../common/admin-common.module';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [AdminCommonModule, StorageModule],
  controllers: [AdminPropertiesController],
  providers: [AdminPropertiesService],
  exports: [AdminPropertiesService],
})
export class AdminPropertiesModule {}
