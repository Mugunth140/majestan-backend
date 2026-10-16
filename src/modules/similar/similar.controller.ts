import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { SimilarService } from './similar.service';

@Controller('similar')
export class SimilarController {
  constructor(private readonly similarService: SimilarService) {}

  @Public()
  @Get('properties/:id')
  properties(@Param('id', ParseIntPipe) id: number) {
    return this.similarService.similarProperties(id);
  }

  @Public()
  @Get('projects/:id')
  projects(@Param('id', ParseIntPipe) id: number) {
    return this.similarService.similarProjects(id);
  }
}
