import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminSeoController } from './admin-seo.controller';
import { AdminSeoService } from './admin-seo.service';
import { PropertySeo } from '../../../database/entities/property-seo.entity';
import { Property } from '../../../database/entities/property.entity';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([PropertySeo, Property]), StorageModule],
  controllers: [AdminSeoController],
  providers: [AdminSeoService],
})
export class AdminSeoModule {}
