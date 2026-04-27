import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { AdminEnquiriesService } from './admin-enquiries.service';
import { AdminEnquiryQueryDto } from './dto/admin-enquiry-query.dto';

@Roles(AppRole.Admin)
@Controller('admin')
export class AdminEnquiriesController {
  constructor(private readonly adminEnquiriesService: AdminEnquiriesService) {}

  @Get('enquiries')
  async listEnquiries(@Query() query: AdminEnquiryQueryDto) {
    return this.adminEnquiriesService.listEnquiries(query);
  }

  @Get('sale-enquiries')
  async listSaleEnquiries(@Query() query: AdminEnquiryQueryDto) {
    return this.adminEnquiriesService.listSaleEnquiries(query);
  }

  @Get('property-submissions')
  async listPropertySubmissions(@Query() query: AdminEnquiryQueryDto) {
    return this.adminEnquiriesService.listPropertySubmissions(query);
  }
}
