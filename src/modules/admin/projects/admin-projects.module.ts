import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../../../database/entities/project.entity';
import { ProjectUnit } from '../../../database/entities/project-unit.entity';
import { ProjectAmenity } from '../../../database/entities/project-amenity.entity';
import { ProjectFaq } from '../../../database/entities/project-faq.entity';
import { ProjectUnitFurnishing } from '../../../database/entities/project-unit-furnishing.entity';
import { ProjectSeo } from '../../../database/entities/project-seo.entity';
import { AdminProjectsController } from './admin-projects.controller';
import { AdminProjectsService } from './admin-projects.service';
import { StorageModule } from '../../storage/storage.module';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectUnit, ProjectAmenity, ProjectFaq, ProjectUnitFurnishing, ProjectSeo]), StorageModule],
  controllers: [AdminProjectsController],
  providers: [AdminProjectsService],
  exports: [AdminProjectsService],
})
export class AdminProjectsModule {}
