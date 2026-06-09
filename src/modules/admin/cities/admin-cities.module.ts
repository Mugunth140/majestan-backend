import { Module } from '@nestjs/common';
import { AdminCitiesController } from './admin-cities.controller';
import { AdminCitiesService } from './admin-cities.service';
import { AdminCommonModule } from '../common/admin-common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from '../../../database/entities/city.entity';

@Module({
  imports: [AdminCommonModule, TypeOrmModule.forFeature([City])],
  controllers: [AdminCitiesController],
  providers: [AdminCitiesService],
})
export class AdminCitiesModule {}
