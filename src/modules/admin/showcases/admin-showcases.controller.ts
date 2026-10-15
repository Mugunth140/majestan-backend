// admin-showcases.controller.ts
import { Body, Controller, Get, Param, Put, Query } from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { ShowcasesService } from '../../showcases/showcases.service';
import { ReplaceShowcaseDto } from './dto/replace-showcase.dto';

/**
 * CRM curation of the home page's showcase sections
 * (`handpicked_properties`, `featured_projects`).
 */
@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/showcases')
export class AdminShowcasesController {
  constructor(private readonly showcasesService: ShowcasesService) {}

  // NOTE: /:section/candidates declared BEFORE /:section
  @Get(':section/candidates')
  candidates(@Param('section') section: string, @Query('q') q?: string) {
    return this.showcasesService.candidates(ShowcasesService.parseSection(section), q ?? '');
  }

  @Get(':section')
  list(@Param('section') section: string) {
    return this.showcasesService.adminList(ShowcasesService.parseSection(section));
  }

  @Put(':section')
  replace(@Param('section') section: string, @Body() dto: ReplaceShowcaseDto) {
    return this.showcasesService.replace(ShowcasesService.parseSection(section), dto.ids);
  }
}
