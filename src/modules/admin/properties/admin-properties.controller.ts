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
import { UpdatePropertyStatusDto } from './dto/update-property-status.dto';
import { AdminPropertiesService } from './admin-properties.service';
import { AdminPropertyQueryDto } from './dto/admin-property-query.dto';
import { CreatePropertyDto } from './dto/create-property.dto';

@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/properties')
export class AdminPropertiesController {
  constructor(
    private readonly adminPropertiesService: AdminPropertiesService,
  ) {}

  // NOTE: listAll declared BEFORE ':propertyType' so 'all' isn't swallowed as a type
  @Get('all')
  async listAll(@Query() query: AdminPropertyQueryDto) {
    return this.adminPropertiesService.listAll(query);
  }

  // NOTE: declared BEFORE ':propertyType/:id' for the same reason
  @Get('by-id/:id')
  async detailsById(@Param('id', ParseIntPipe) id: number) {
    return this.adminPropertiesService.detailsById(id);
  }

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
    @Body() payload: CreatePropertyDto,
  ) {
    return this.adminPropertiesService.create(propertyType, payload);
  }

  @Patch(':propertyType/:id')
  async update(
    @Param('propertyType') propertyType: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: Partial<CreatePropertyDto>,
  ) {
    return this.adminPropertiesService.update(propertyType, id, payload);
  }

  @Patch(':propertyType/:id/status')
  async updateStatus(
    @Param('propertyType') propertyType: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdatePropertyStatusDto,
  ) {
    return this.adminPropertiesService.updateStatus(
      propertyType,
      id,
      payload.status,
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
