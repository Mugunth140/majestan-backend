import { Module } from '@nestjs/common';
import { AdminSublocationsController } from './admin-sublocations.controller';
import { AdminSublocationsService } from './admin-sublocations.service';
import { AdminCommonModule } from '../common/admin-common.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from '../../../database/entities/city.entity';
import { Sublocation } from '../../../database/entities/sublocation.entity';

@Module({
  imports: [
    AdminCommonModule,
    TypeOrmModule.forFeature([City, Sublocation]),
  ],
  controllers: [AdminSublocationsController],
  providers: [AdminSublocationsService],
})
export class AdminSublocationsModule {}
