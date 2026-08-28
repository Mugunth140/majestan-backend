import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ListingPageSeo } from '../../../database/entities/listing-page-seo.entity';
import { ListingPageSeoService } from './listing-page-seo.service';
import { AdminListingPageSeoController, PublicSeoController } from './listing-page-seo.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ListingPageSeo])],
  providers: [ListingPageSeoService],
  controllers: [AdminListingPageSeoController, PublicSeoController],
  exports: [ListingPageSeoService],
})
export class ListingPageSeoModule {}
