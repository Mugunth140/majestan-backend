import { Module } from '@nestjs/common';
import { GoogleReviewsService } from './google-reviews.service';

@Module({
  providers: [GoogleReviewsService],
  exports: [GoogleReviewsService],
})
export class ReviewsModule {}
