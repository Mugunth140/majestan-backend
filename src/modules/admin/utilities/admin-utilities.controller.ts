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
import { AdminUtilitiesService } from './admin-utilities.service';

@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/utilities')
export class AdminUtilitiesController {
  constructor(private readonly adminUtilitiesService: AdminUtilitiesService) {}

  @Get()
  async list(@Query() query: PaginationQueryDto) {
    return this.adminUtilitiesService.list(query);
  }

  @Get(':id')
  async details(@Param('id', ParseIntPipe) id: number) {
    return this.adminUtilitiesService.details(id);
  }

  @Post()
  async create(@Body() payload: UpsertRecordDto) {
    return this.adminUtilitiesService.create(payload);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpsertRecordDto,
  ) {
    return this.adminUtilitiesService.update(id, payload);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStatusDto,
  ) {
    return this.adminUtilitiesService.updateStatus(id, payload.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminUtilitiesService.remove(id);
  }
}
