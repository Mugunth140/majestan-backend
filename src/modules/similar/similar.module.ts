import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module';
import { SimilarController } from './similar.controller';
import { SimilarService } from './similar.service';

@Module({
  imports: [StorageModule],
  controllers: [SimilarController],
  providers: [SimilarService],
})
export class SimilarModule {}
