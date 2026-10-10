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
  PLOT = 'plot',
}

export enum PossessionStatus {
  UNDER_CONSTRUCTION = 'under_construction',
  READY_TO_MOVE = 'ready_to_move',
  NEW_LAUNCH = 'new_launch',
}

export enum ProjectStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  BOOKED = 'booked',
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

  @Index('idx_projects_project_code', ['projectCode'], { unique: true })
  @Column({ name: 'project_code', type: 'varchar', length: 20, nullable: true })
  projectCode!: string | null;

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

  @Column({ name: 'total_floors', type: 'smallint', unsigned: true, nullable: true })
  totalFloors!: number | null;

  @Column({ name: 'project_area_sqft', type: 'decimal', precision: 12, scale: 2, nullable: true })
  projectAreaSqft!: string | null;

  @Column({ name: 'tower_details', type: 'json', nullable: true })
  towerDetails!: { tower?: string; floors?: number; units?: number }[] | null;

  @Column({ name: 'pincode', type: 'varchar', length: 20, nullable: true })
  pincode!: string | null;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

  @Column({ name: 'highlights', type: 'text', nullable: true })
  highlights!: string | null;

  @Column({ name: 'specifications', type: 'json', nullable: true })
  specifications!: { label: string; value: string }[] | null;

  @Column({ name: 'brochure_key', type: 'varchar', length: 1024, nullable: true })
  brochureKey!: string | null;

  @Column({ name: 'brochure_name', type: 'varchar', length: 255, nullable: true })
  brochureName!: string | null;

  @Column({ name: 'connectivity', type: 'json', nullable: true })
  connectivity!: { icon?: string; label?: string; detail?: string }[] | null;

  @Column({ name: 'nearby_categories', type: 'json', nullable: true })
  nearbyCategories!: { title?: string; icon?: string; places?: { name?: string; distance?: string }[] }[] | null;

  @Column({ name: 'total_units', type: 'int', unsigned: true, nullable: true })
  totalUnits!: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'cover_image_url', type: 'varchar', length: 1024, nullable: true })
  coverImageUrl!: string | null;

  @Column({ name: 'mobile_cover_image_url', type: 'varchar', length: 1024, nullable: true })
  mobileCoverImageUrl!: string | null;

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

  @OneToMany('ProjectAmenity', (projectAmenity: any) => projectAmenity.project, { lazy: true })
  projectAmenities!: Promise<any[]>;

  @OneToMany('ProjectFaq', (faq: any) => faq.project, { lazy: true })
  projectFaqs!: Promise<any[]>;

  @OneToOne('ProjectSeo', (seo: any) => seo.project, { lazy: true, nullable: true })
  seo!: Promise<ProjectSeo | null>;
}
