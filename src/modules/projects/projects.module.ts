import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../database/entities/project.entity';
import { ProjectUnit } from '../../database/entities/project-unit.entity';
import { ProjectSeo } from '../../database/entities/project-seo.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectUnit, ProjectSeo]), StorageModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
