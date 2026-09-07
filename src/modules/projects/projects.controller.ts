import { Controller, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { ProjectsService } from './projects.service';
import { ProjectSearchQueryDto } from './dto/project-search.dto';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Public()
  @Get()
  async list(@Query() query: ProjectSearchQueryDto) {
    return this.projectsService.list(query);
  }

  @Public()
  @Get('by-slug/:slug')
  async detailsBySlug(@Param('slug') slug: string) {
    return this.projectsService.detailsBySlug(slug);
  }

  @Public()
  @Get('all-slugs')
  async getAllSlugs() {
    return this.projectsService.getAllSlugs();
  }
}
