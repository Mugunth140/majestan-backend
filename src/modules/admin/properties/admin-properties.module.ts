import { Module } from '@nestjs/common';
import { AdminPropertiesController } from './admin-properties.controller';
import { AdminPropertiesService } from './admin-properties.service';
import { AdminCommonModule } from '../common/admin-common.module';
import { StorageModule } from '../../storage/storage.module';
import { SearchModule } from '../../search/search.module';

@Module({
  imports: [AdminCommonModule, StorageModule, SearchModule],
  controllers: [AdminPropertiesController],
  providers: [AdminPropertiesService],
  exports: [AdminPropertiesService],
})
export class AdminPropertiesModule {}
