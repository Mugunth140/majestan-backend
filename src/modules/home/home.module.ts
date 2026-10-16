import { Module } from '@nestjs/common';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { ShowcasesModule } from '../showcases/showcases.module';
import { ReviewsModule } from '../reviews/reviews.module';

@Module({
  imports: [ShowcasesModule, ReviewsModule],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
