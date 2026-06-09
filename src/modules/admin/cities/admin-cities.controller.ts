import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpdateStatusDto } from '../common/dto/update-status.dto';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminCitiesService } from './admin-cities.service';
import { Public } from '../../../common/decorators/public.decorator';
@Roles(AppRole.Admin)
@Controller('admin/cities')
export class AdminCitiesController {
  constructor(private readonly adminCitiesService: AdminCitiesService) {}

  @Get()
  async list(@Query() query: PaginationQueryDto) {
    return this.adminCitiesService.list(query);
  }

  @Public()
  @Get('all')
  async listAll() {
    return this.adminCitiesService.listAll();
  }

  @Get(':id')
  async details(@Param('id', ParseIntPipe) id: number) {
    return this.adminCitiesService.details(id);
  }

  @Post()
  async create(@Body() payload: UpsertRecordDto) {
    return this.adminCitiesService.create(payload);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpsertRecordDto,
  ) {
    return this.adminCitiesService.update(id, payload);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStatusDto,
  ) {
    return this.adminCitiesService.updateStatus(id, payload.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminCitiesService.remove(id);
  }
}
