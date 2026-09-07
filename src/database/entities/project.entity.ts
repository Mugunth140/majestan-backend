import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ProjectUnit } from './project-unit.entity';
import { ProjectSeo } from './project-seo.entity';

export enum ProjectType {
  APARTMENT = 'apartment',
  VILLA = 'villa',
}

export enum PossessionStatus {
  UNDER_CONSTRUCTION = 'under_construction',
  READY_TO_MOVE = 'ready_to_move',
}

export enum ProjectStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

@Entity('projects')
@Index('idx_projects_city', ['city'])
@Index('idx_projects_type', ['projectType'])
@Index('idx_projects_status', ['status'])
@Index('idx_projects_slug', ['slug'], { unique: true })
@Index('idx_projects_canonical', ['canonicalSlug'], { unique: true })
export class Project {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ name: 'slug', type: 'varchar', length: 512, nullable: false, unique: true })
  slug!: string;

  @Column({ name: 'canonical_slug', type: 'varchar', length: 512, nullable: false, unique: true })
  canonicalSlug!: string;

  @Column({ name: 'project_type', type: 'enum', enum: ProjectType, nullable: false })
  projectType!: ProjectType;

  @Column({ name: 'builder_name', type: 'varchar', length: 255, nullable: true })
  builderName!: string | null;

  @Column({ name: 'rera_number', type: 'varchar', length: 100, nullable: true })
  reraNumber!: string | null;

  @Column({ name: 'possession_date', type: 'date', nullable: true })
  possessionDate!: string | null;

  @Column({ name: 'possession_status', type: 'enum', enum: PossessionStatus, nullable: false, default: PossessionStatus.UNDER_CONSTRUCTION })
  possessionStatus!: PossessionStatus;

  @Column({ name: 'city', type: 'varchar', length: 255, nullable: false })
  city!: string;

  @Column({ name: 'state', type: 'varchar', length: 255, nullable: true })
  state!: string | null;

  @Column({ name: 'sublocation', type: 'varchar', length: 255, nullable: true })
  sublocation!: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address!: string | null;

  @Column({ name: 'towers', type: 'smallint', unsigned: true, nullable: true })
  towers!: number | null;

  @Column({ name: 'total_units', type: 'int', unsigned: true, nullable: true })
  totalUnits!: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'cover_image_url', type: 'varchar', length: 1024, nullable: true })
  coverImageUrl!: string | null;

  @Column({ name: 'gallery_image_urls', type: 'json', nullable: true })
  galleryImageUrls!: string[] | null;

  @Column({ name: 'status', type: 'enum', enum: ProjectStatus, nullable: false, default: ProjectStatus.DRAFT })
  status!: ProjectStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt!: Date;

  @OneToMany('ProjectUnit', (unit: any) => unit.project, { lazy: true })
  units!: Promise<ProjectUnit[]>;

  @OneToOne('ProjectSeo', (seo: any) => seo.project, { lazy: true, nullable: true })
  seo!: Promise<ProjectSeo | null>;
}
