import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import { SeoPageData } from './property-seo.entity';

export interface ProjectSeoData {
  overview?: SeoPageData;
  faqs?: { question: string; answer: string }[];
}

@Entity('project_seo')
export class ProjectSeo {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'project_id', type: 'int', unsigned: true, nullable: false, unique: true })
  projectId!: number;

  @Column({ name: 'seo_data', type: 'json', nullable: false })
  seoData: ProjectSeoData = {};

  @Column({ name: 'verification_status', type: 'varchar', length: 50, default: 'Pending' })
  verificationStatus!: string;

  @Column({ name: 'approval_status', type: 'varchar', length: 50, default: 'Pending' })
  approvalStatus!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt!: Date;

  @OneToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: Project;
}
