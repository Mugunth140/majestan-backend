import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PropertiesController } from './properties.controller';
import { PropertiesService } from './properties.service';
import { Property } from '../../database/entities/property.entity';
import { AdminPropertiesModule } from '../admin/properties/admin-properties.module';
import { StorageModule } from '../storage/storage.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [TypeOrmModule.forFeature([Property]), AdminPropertiesModule, StorageModule, SearchModule],
  controllers: [PropertiesController],
  providers: [PropertiesService],
  exports: [PropertiesService],
})
export class PropertiesModule {}
