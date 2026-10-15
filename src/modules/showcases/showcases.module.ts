import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShowcaseItem } from '../../database/entities/showcase-item.entity';
import { StorageModule } from '../storage/storage.module';
import { ShowcasesService } from './showcases.service';

@Module({
  imports: [StorageModule, TypeOrmModule.forFeature([ShowcaseItem])],
  providers: [ShowcasesService],
  exports: [ShowcasesService],
})
export class ShowcasesModule {}
