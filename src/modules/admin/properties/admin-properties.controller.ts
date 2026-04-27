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
import { UpdateStatusDto } from '../common/dto/update-status.dto';
import { UpsertRecordDto } from '../common/dto/upsert-record.dto';
import { AdminPropertiesService } from './admin-properties.service';
import { AdminPropertyQueryDto } from './dto/admin-property-query.dto';
import { ToggleBookingStatusDto } from './dto/toggle-booking-status.dto';

@Roles(AppRole.Admin)
@Controller('admin/properties')
export class AdminPropertiesController {
  constructor(
    private readonly adminPropertiesService: AdminPropertiesService,
  ) {}

  @Get(':propertyType')
  async list(
    @Param('propertyType') propertyType: string,
    @Query() query: AdminPropertyQueryDto,
  ) {
    return this.adminPropertiesService.list(propertyType, query);
  }

  @Get(':propertyType/:id')
  async details(
    @Param('propertyType') propertyType: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminPropertiesService.details(propertyType, id);
  }

  @Post(':propertyType')
  async create(
    @Param('propertyType') propertyType: string,
    @Body() payload: UpsertRecordDto,
  ) {
    return this.adminPropertiesService.create(propertyType, payload);
  }

  @Patch(':propertyType/:id')
  async update(
    @Param('propertyType') propertyType: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpsertRecordDto,
  ) {
    return this.adminPropertiesService.update(propertyType, id, payload);
  }

  @Patch(':propertyType/:id/status')
  async updateStatus(
    @Param('propertyType') propertyType: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStatusDto,
  ) {
    return this.adminPropertiesService.updateStatus(
      propertyType,
      id,
      payload.status,
    );
  }

  @Patch(':propertyType/:id/booking-status')
  async updateBookingStatus(
    @Param('propertyType') propertyType: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: ToggleBookingStatusDto,
  ) {
    return this.adminPropertiesService.updateBookingStatus(
      propertyType,
      id,
      payload,
    );
  }

  @Delete(':propertyType/:id')
  async remove(
    @Param('propertyType') propertyType: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.adminPropertiesService.remove(propertyType, id);
  }
}
