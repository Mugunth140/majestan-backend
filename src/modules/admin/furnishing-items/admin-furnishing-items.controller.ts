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
import { AdminFurnishingItemsService } from './admin-furnishing-items.service';

@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/furnishing-items')
export class AdminFurnishingItemsController {
  constructor(private readonly adminFurnishingItemsService: AdminFurnishingItemsService) {}

  @Get()
  async list(@Query() query: PaginationQueryDto) {
    return this.adminFurnishingItemsService.list(query);
  }

  @Get(':id')
  async details(@Param('id', ParseIntPipe) id: number) {
    return this.adminFurnishingItemsService.details(id);
  }

  @Post()
  async create(@Body() payload: UpsertRecordDto) {
    return this.adminFurnishingItemsService.create(payload);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpsertRecordDto,
  ) {
    return this.adminFurnishingItemsService.update(id, payload);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStatusDto,
  ) {
    return this.adminFurnishingItemsService.updateStatus(id, payload.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminFurnishingItemsService.remove(id);
  }
}
