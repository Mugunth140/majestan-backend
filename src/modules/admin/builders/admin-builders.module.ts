import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Builder } from '../../../database/entities/builder.entity';
import { StorageModule } from '../../storage/storage.module';
import { AdminBuildersController } from './admin-builders.controller';
import { AdminBuildersService } from './admin-builders.service';

@Module({
  imports: [TypeOrmModule.forFeature([Builder]), StorageModule],
  controllers: [AdminBuildersController],
  providers: [AdminBuildersService],
  exports: [AdminBuildersService],
})
export class AdminBuildersModule {}
