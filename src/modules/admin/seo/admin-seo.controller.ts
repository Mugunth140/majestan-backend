import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Put,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { AdminSeoService } from './admin-seo.service';
import { UpsertPropertySeoDto } from './dto/upsert-property-seo.dto';

@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/seo')
export class AdminSeoController {
  constructor(private readonly adminSeoService: AdminSeoService) {}

  @Get('properties')
  async getPropertySeoList(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminSeoService.getPropertySeoList(
      page ? Number(page) : 1,
      limit ? Math.min(Number(limit), 500) : 100,
    );
  }

  @Get('properties/:id')
  async getPropertySeo(@Param('id', ParseIntPipe) id: number) {
    return this.adminSeoService.getPropertySeo(id);
  }

  @Put('properties/:id')
  async upsertPropertySeo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpsertPropertySeoDto,
  ) {
    return this.adminSeoService.upsertPropertySeo(id, dto);
  }

  @Post('properties/:id/generate-locality')
  async generateLocality(@Param('id', ParseIntPipe) id: number) {
    return this.adminSeoService.generateLocalityData(id);
  }
}
