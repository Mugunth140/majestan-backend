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
import { AdminLocalitiesService } from './admin-localities.service';

@Roles(AppRole.Admin)
@Controller('admin/localities')
export class AdminLocalitiesController {
  constructor(private readonly adminLocalitiesService: AdminLocalitiesService) {}

  @Get()
  async list(@Query() query: PaginationQueryDto) {
    return this.adminLocalitiesService.list(query);
  }

  @Get(':id')
  async details(@Param('id', ParseIntPipe) id: number) {
    return this.adminLocalitiesService.details(id);
  }

  @Post()
  async create(@Body() payload: UpsertRecordDto) {
    return this.adminLocalitiesService.create(payload);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpsertRecordDto,
  ) {
    return this.adminLocalitiesService.update(id, payload);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStatusDto,
  ) {
    return this.adminLocalitiesService.updateStatus(id, payload.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminLocalitiesService.remove(id);
  }
}
