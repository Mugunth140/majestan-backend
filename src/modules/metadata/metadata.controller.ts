import { Controller, Get } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { MetadataService } from './metadata.service';

@Public()
@Controller('metadata')
export class MetadataController {
  constructor(private readonly metadataService: MetadataService) {}

  @Get('sublocations')
  async listSublocations() {
    return this.metadataService.listSublocations();
  }

  @Get('unittypes')
  async listUnitTypes() {
    return this.metadataService.listUnitTypes();
  }
}
