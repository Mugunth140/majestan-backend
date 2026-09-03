import { Controller, Get, Param, ParseIntPipe, Query, Post, Body, BadRequestException } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CreatePropertyDto } from '../admin/properties/dto/create-property.dto';
import { PropertiesService } from './properties.service';
import { PropertySearchQueryDto } from './dto/property-search.dto';
import { StorageService } from '../storage/storage.service';

@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly storageService: StorageService,
  ) {}

  @Public()
  @Get()
  async search(@Query() query: PropertySearchQueryDto) {
    return this.propertiesService.search(query);
  }

  @Public()
  @Get('by-slug/:slug')
  async detailsBySlug(@Param('slug') slug: string) {
    return this.propertiesService.detailsBySlug(slug);
  }

  @Public()
  @Get('all-slugs')
  async getAllSlugs() {
    return this.propertiesService.getAllSlugs();
  }

  @Public()
  @Get(':propertyType/:id')
  async details(
    @Param('propertyType') propertyType: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.propertiesService.details(propertyType, id);
  }

  @Public()
  @Post('submit/:propertyType')
  async submit(
    @Param('propertyType') propertyType: string,
    @Body() payload: CreatePropertyDto,
  ) {
    return this.propertiesService.submit(propertyType, payload);
  }

  // presigned-url requires a valid JWT — NOT @Public
  @Get('presigned-url')
  async getPresignedUrl(
    @Query('fileName') fileName: string,
    @Query('fileType') fileType: string,
  ) {
    if (!fileName || !fileType) {
      throw new BadRequestException('fileName and fileType are required');
    }
    const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'];
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      throw new BadRequestException(`fileType must be one of: ${ALLOWED_MIME_TYPES.join(', ')}`);
    }
    return this.storageService.generatePresignedUrl(fileName, fileType);
  }

  @Public()
  @Get('form-data')
  async getFormData() {
    return this.propertiesService.getFormData();
  }
}
