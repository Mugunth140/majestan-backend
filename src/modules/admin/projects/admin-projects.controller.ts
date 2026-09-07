import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AppRole } from '../../../common/enums/app-role.enum';
import { AdminProjectsService } from './admin-projects.service';
import { CreateProjectDto, UpdateProjectDto } from './dto/create-project.dto';
import { UpdateProjectStatusDto } from './dto/update-project-status.dto';
import { ProjectSeoData } from '../../../database/entities/project-seo.entity';

@Roles(AppRole.Admin, AppRole.Staff)
@Controller('admin/projects')
export class AdminProjectsController {
  constructor(private readonly adminProjectsService: AdminProjectsService) {}

  @Get()
  async list(@Query('page') page = 1, @Query('limit') limit = 20, @Query('search') search?: string, @Query('status') status?: string, @Query('projectType') projectType?: string) {
    return this.adminProjectsService.list(Number(page), Number(limit), search, status, projectType);
  }

  @Get(':id')
  async details(@Param('id', ParseIntPipe) id: number) {
    return this.adminProjectsService.details(id);
  }

  @Post()
  async create(@Body() payload: CreateProjectDto) {
    return this.adminProjectsService.create(payload);
  }

  @Patch(':id')
  async update(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateProjectDto) {
    return this.adminProjectsService.update(id, payload);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id', ParseIntPipe) id: number, @Body() payload: UpdateProjectStatusDto) {
    return this.adminProjectsService.updateStatus(id, payload.status);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminProjectsService.remove(id);
  }

  @Get(':id/seo')
  async getSeo(@Param('id', ParseIntPipe) id: number) {
    return this.adminProjectsService.getSeo(id);
  }

  @Put(':id/seo')
  async upsertSeo(@Param('id', ParseIntPipe) id: number, @Body() body: { seoData: ProjectSeoData; verificationStatus?: string; approvalStatus?: string }) {
    return this.adminProjectsService.upsertSeo(id, body.seoData, body.verificationStatus, body.approvalStatus);
  }
}
