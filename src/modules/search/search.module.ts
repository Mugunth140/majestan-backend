import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SearchService } from './search.service';
import { SearchController, AdminSearchController } from './search.controller';

@Module({
  imports: [ConfigModule],
  controllers: [SearchController, AdminSearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
