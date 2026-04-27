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
import { AdminBannersService } from './admin-banners.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { UpdateStatusDto } from '../common/dto/update-status.dto';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';

@Roles(AppRole.Admin)
@Controller('admin/banners')
export class AdminBannersController {
  constructor(private readonly adminBannersService: AdminBannersService) {}

  @Get()
  async list(@Query() query: PaginationQueryDto) {
    return this.adminBannersService.list(query);
  }

  @Get(':id')
  async details(@Param('id', ParseIntPipe) id: number) {
    return this.adminBannersService.details(id);
  }

  @Post()
  async create(@Body() payload: UpsertRecordDto) {
    return this.adminBannersService.create(payload);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpsertRecordDto,
  ) {
    return this.adminBannersService.update(id, payload);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStatusDto,
  ) {
    return this.adminBannersService.updateStatus(id, payload);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminBannersService.remove(id);
  }
}
