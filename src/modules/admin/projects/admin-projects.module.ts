import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../../database/entities/project.entity';
import { ProjectUnit } from '../../../database/entities/project-unit.entity';
import { ProjectSeo } from '../../../database/entities/project-seo.entity';
import { AdminProjectsController } from './admin-projects.controller';
import { AdminProjectsService } from './admin-projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectUnit, ProjectSeo])],
  controllers: [AdminProjectsController],
  providers: [AdminProjectsService],
  exports: [AdminProjectsService],
})
export class AdminProjectsModule {}
