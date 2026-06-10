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
import { AdminSublocationsService } from './admin-sublocations.service';
import { UpsertSublocationDto } from './dto/upsert-sublocation.dto';

@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/sublocations')
export class AdminSublocationsController {
  constructor(private readonly adminSublocationsService: AdminSublocationsService) {}

  @Get()
  async list(@Query() query: PaginationQueryDto) {
    return this.adminSublocationsService.list(query);
  }

  @Get('all')
  async listAll() {
    return this.adminSublocationsService.listAll();
  }

  @Get(':id')
  async details(@Param('id', ParseIntPipe) id: number) {
    return this.adminSublocationsService.details(id);
  }

  @Post()
  async create(@Body() payload: UpsertSublocationDto) {
    return this.adminSublocationsService.create(payload);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpsertSublocationDto,
  ) {
    return this.adminSublocationsService.update(id, payload);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStatusDto,
  ) {
    return this.adminSublocationsService.updateStatus(id, payload.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminSublocationsService.remove(id);
  }
}
