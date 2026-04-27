import { Body, Controller, Get, Put } from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminBusinessService } from './admin-business.service';

@Roles(AppRole.Admin)
@Controller('admin/business')
export class AdminBusinessController {
  constructor(private readonly adminBusinessService: AdminBusinessService) {}

  @Get('setup')
  async getSetup() {
    return this.adminBusinessService.getSetup();
  }

  @Put('setup')
  async upsertSetup(@Body() payload: UpsertRecordDto) {
    return this.adminBusinessService.upsertSetup(payload);
  }

  @Get('profile')
  async getProfile() {
    return this.adminBusinessService.getProfile();
  }

  @Put('profile')
  async upsertProfile(@Body() payload: UpsertRecordDto) {
    return this.adminBusinessService.upsertProfile(payload);
  }
}
