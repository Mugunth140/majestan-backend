// admin-ads.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ad } from '../../../database/entities/ad.entity';
import { AdminCommonModule } from '../common/admin-common.module';
import { StorageModule } from '../../storage/storage.module';
import { AdminAdsController } from './admin-ads.controller';
import { AdminAdsService } from './admin-ads.service';

@Module({
  imports: [AdminCommonModule, StorageModule, TypeOrmModule.forFeature([Ad])],
  controllers: [AdminAdsController],
  providers: [AdminAdsService],
  exports: [AdminAdsService],
})
export class AdminAdsModule {}
