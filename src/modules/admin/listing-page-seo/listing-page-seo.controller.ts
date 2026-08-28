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
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { Public } from '../../../common/decorators/public.decorator';
import { ListingPageSeoService } from './listing-page-seo.service';
import { UpsertListingPageSeoDto } from './dto/upsert-listing-page-seo.dto';

// Public endpoint — used by Next.js generateMetadata to look up SEO overrides
@Controller('seo')
export class PublicSeoController {
  constructor(private readonly service: ListingPageSeoService) {}

  @Public()
  @Get('listing-page')
  async getByPath(@Query('path') path: string) {
    if (!path) return null;
    const record = await this.service.findByPath(path);
    return record ?? null;
  }
}

// Admin endpoints
@Controller('admin/seo/listing-pages')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.Admin)
export class AdminListingPageSeoController {
  constructor(private readonly service: ListingPageSeoService) {}

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() dto: UpsertListingPageSeoDto) {
    const pageKey = dto.pageKey;
    if (!pageKey) throw new Error('pageKey is required');
    return this.service.upsertByPath(pageKey, dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpsertListingPageSeoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
