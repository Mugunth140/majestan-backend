import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CreateEnquiryDto } from './dto/create-enquiry.dto';
import { CreatePropertySubmissionDto } from './dto/create-property-submission.dto';
import { LeadsService } from './leads.service';

@Public()
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post('enquiry')
  async createEnquiry(@Body() payload: CreateEnquiryDto) {
    return this.leadsService.createEnquiry(payload);
  }

  @Post('property-submission')
  async createPropertySubmission(@Body() payload: CreatePropertySubmissionDto) {
    return this.leadsService.createPropertySubmission(payload);
  }
}
