import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AppRole } from '../../common/enums/app-role.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SearchService } from './search.service';
import { SearchQueryDto } from './dto/search.dto';

@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  async search(@Query() query: SearchQueryDto) {
    if (!this.searchService.isEnabled()) {
      return { hits: [], total: 0, page: query.page, limit: query.limit, fallback: true };
    }
    try {
      const scope = query.scope === 'projects' ? 'projects' : 'properties';
      const res = await this.searchService.search(query.q || '', { propertyType: query.propertyType, listingType: query.listingType, city: query.city, locality: query.locality }, query.page, query.limit, query.hybrid ?? false, scope);
      return { ...res, fallback: false, scope };
    } catch {
      return { hits: [], total: 0, page: query.page, limit: query.limit, fallback: true };
    }
  }

  @Get('health')
  async health() {
    return this.searchService.health();
  }

  @Post('reindex')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.Admin)
  async reindex() {
    const res = await this.searchService.reindexAll();
    const projects = await this.searchService.reindexAllProjects();
    return { success: true, ...res, projects };
  }
}

@Controller('admin/search')
export class AdminSearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('reindex')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.Admin)
  async reindex() {
    const res = await this.searchService.reindexAll();
    const projects = await this.searchService.reindexAllProjects();
    return { success: true, ...res, projects };
  }

  @Get('health')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.Admin)
  async health() {
    return this.searchService.health();
  }
}
