import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ad } from '../../database/entities/ad.entity';
import { StorageModule } from '../storage/storage.module';
import { AdsController } from './ads.controller';
import { AdsService } from './ads.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ad]), StorageModule],
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}
