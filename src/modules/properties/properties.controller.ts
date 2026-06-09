import { Controller, Get, Param, ParseIntPipe, Query, Post, Body } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CreatePropertyDto } from '../admin/properties/dto/create-property.dto';
import { PropertiesService } from './properties.service';
import { PropertySearchQueryDto } from './dto/property-search.dto';
import { StorageService } from '../storage/storage.service';

@Public()
@Controller('properties')
export class PropertiesController {
  constructor(
    private readonly propertiesService: PropertiesService,
    private readonly storageService: StorageService,
  ) {}

  @Get()
  async search(@Query() query: PropertySearchQueryDto) {
    return this.propertiesService.search(query);
  }

  @Get('by-slug/:slug')
  async detailsBySlug(@Param('slug') slug: string) {
    return this.propertiesService.detailsBySlug(slug);
  }

  @Get(':propertyType/:id')
  async details(
    @Param('propertyType') propertyType: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.propertiesService.details(propertyType, id);
  }

  @Post('submit/:propertyType')
  async submit(
    @Param('propertyType') propertyType: string,
    @Body() payload: CreatePropertyDto,
  ) {
    return this.propertiesService.submit(propertyType, payload);
  }

  @Get('presigned-url')
  async getPresignedUrl(
    @Query('fileName') fileName: string,
    @Query('fileType') fileType: string,
  ) {
    if (!fileName || !fileType) {
      throw new Error('fileName and fileType are required');
    }
    return this.storageService.generatePresignedUrl(fileName, fileType);
  }

  @Get('form-data')
  async getFormData() {
    return this.propertiesService.getFormData();
  }
}
