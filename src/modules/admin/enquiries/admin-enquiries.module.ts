import { Module } from '@nestjs/common';
import { AdminEnquiriesController } from './admin-enquiries.controller';
import { AdminEnquiriesService } from './admin-enquiries.service';

@Module({
  controllers: [AdminEnquiriesController],
  providers: [AdminEnquiriesService],
  exports: [AdminEnquiriesService],
})
export class AdminEnquiriesModule {}
