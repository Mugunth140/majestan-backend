import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PropertiesService } from './properties.service';
import { PropertySearchQueryDto } from './dto/property-search.dto';

@Public()
@Controller('properties')
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Get()
  async search(@Query() query: PropertySearchQueryDto) {
    return this.propertiesService.search(query);
  }

  @Get(':propertyType/:id')
  async details(
    @Param('propertyType') propertyType: string,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.propertiesService.details(propertyType, id);
  }
}
