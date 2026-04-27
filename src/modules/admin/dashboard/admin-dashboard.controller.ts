import { Controller, Get } from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { AdminDashboardService } from './admin-dashboard.service';

@Roles(AppRole.Admin)
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('summary')
  async summary() {
    return this.adminDashboardService.summary();
  }
}
