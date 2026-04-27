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
import { AdminBlogsService } from './admin-blogs.service';

@Roles(AppRole.Admin)
@Controller('admin/blogs')
export class AdminBlogsController {
  constructor(private readonly adminBlogsService: AdminBlogsService) {}

  @Get()
  async list(@Query() query: PaginationQueryDto) {
    return this.adminBlogsService.list(query);
  }

  @Get(':id')
  async details(@Param('id', ParseIntPipe) id: number) {
    return this.adminBlogsService.details(id);
  }

  @Post()
  async create(@Body() payload: UpsertRecordDto) {
    return this.adminBlogsService.create(payload);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpsertRecordDto,
  ) {
    return this.adminBlogsService.update(id, payload);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStatusDto,
  ) {
    return this.adminBlogsService.updateStatus(id, payload.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminBlogsService.remove(id);
  }
}
