import { IsEnum } from 'class-validator';
import { ProjectStatus } from '../../../../database/entities/project.entity';

export class UpdateProjectStatusDto {
  @IsEnum(ProjectStatus)
  status!: ProjectStatus;
}
