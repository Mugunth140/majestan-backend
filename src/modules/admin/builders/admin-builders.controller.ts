import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { AdminBuildersService } from './admin-builders.service';
import { AdminBuilderQueryDto } from './dto/admin-builder-query.dto';
import { CreateBuilderDto, UpdateBuilderDto } from './dto/create-builder.dto';

@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/builders')
export class AdminBuildersController {
  constructor(private readonly adminBuildersService: AdminBuildersService) {}

  @Get('dropdown')
  async findDropdown() {
    return this.adminBuildersService.findDropdown();
  }

  @Get()
  async findAll(@Query() query: AdminBuilderQueryDto) {
    return this.adminBuildersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.adminBuildersService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateBuilderDto) {
    return this.adminBuildersService.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBuilderDto,
  ) {
    return this.adminBuildersService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminBuildersService.remove(id);
  }
}
