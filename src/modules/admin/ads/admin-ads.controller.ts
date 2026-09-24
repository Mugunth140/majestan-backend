// admin-ads.controller.ts
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
import { ApiQuery } from '@nestjs/swagger';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { AdPlacement } from '../../../database/entities/ad.entity';
import { AdminAdsService } from './admin-ads.service';
import { CreateAdDto } from './dto/create-ad.dto';
import { UpdateAdDto } from './dto/update-ad.dto';
import { UpdateAdStatusDto } from './dto/update-ad-status.dto';
import { ReorderAdsDto } from './dto/reorder-ads.dto';

@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/ads')
export class AdminAdsController {
  constructor(private readonly adminAdsService: AdminAdsService) {}

  // NOTE: /presigned-url and /reorder declared BEFORE /:id to avoid param conflict
  @Get('presigned-url')
  presignedUrl(@Query('fileName') fileName: string, @Query('fileType') fileType: string) {
    return this.adminAdsService.presignedUrl(fileName, fileType);
  }

  @Patch('reorder')
  reorder(@Body() dto: ReorderAdsDto) {
    return this.adminAdsService.reorder(dto.ids);
  }

  @Get()
  @ApiQuery({ name: 'placement', enum: AdPlacement, required: false })
  list(@Query('placement') placement?: string) {
    return this.adminAdsService.list((placement as AdPlacement) || AdPlacement.Hero);
  }

  @Get(':id')
  details(@Param('id', ParseIntPipe) id: number) {
    return this.adminAdsService.details(id);
  }

  @Post()
  create(@Body() dto: CreateAdDto) {
    return this.adminAdsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdDto) {
    return this.adminAdsService.update(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateAdStatusDto) {
    return this.adminAdsService.updateStatus(id, dto.isActive);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminAdsService.remove(id);
  }
}
