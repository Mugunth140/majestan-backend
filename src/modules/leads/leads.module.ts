import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { PropertyEnquiryController } from './property-enquiry.controller';
import { ProjectEnquiryController } from './project-enquiry.controller';
import { LeadsService } from './leads.service';
import { CrmForwardingService } from './crm-forwarding.service';

@Module({
  controllers: [LeadsController, PropertyEnquiryController, ProjectEnquiryController],
  providers: [LeadsService, CrmForwardingService],
  exports: [LeadsService],
})
export class LeadsModule {}
