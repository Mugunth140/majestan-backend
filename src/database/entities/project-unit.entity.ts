import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';
import {
  FacingDirection,
  FurnishedStatus,
  ListingMode,
  PropertyUnitStatus,
  PropertyUnitType,
} from './property-unit.entity';

@Entity('project_units')
@Unique('uq_project_units_project_unit_code', ['projectId', 'unitCode'])
@Index('idx_project_units_project_id', ['projectId'])
@Index('idx_project_units_status', ['status'])
@Index('idx_project_units_price', ['price'])
@Index('idx_project_units_bedrooms', ['bedrooms'])
export class ProjectUnit {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'project_id', type: 'int', unsigned: true, nullable: false })
  projectId!: number;

  @Column({ name: 'unit_code', type: 'varchar', length: 64, nullable: false })
  unitCode!: string;

  @Column({ name: 'title', type: 'varchar', length: 150, nullable: true })
  title!: string | null;

  @Column({ name: 'unit_type', type: 'enum', enum: PropertyUnitType, nullable: false, default: PropertyUnitType.OTHER })
  unitType!: PropertyUnitType;

  @Column({ name: 'bedrooms', type: 'tinyint', unsigned: true, nullable: true })
  bedrooms!: number | null;

  @Column({ name: 'bathrooms', type: 'tinyint', unsigned: true, nullable: true })
  bathrooms!: number | null;

  @Column({ name: 'balconies', type: 'tinyint', unsigned: true, nullable: true })
  balconies!: number | null;

  @Column({ name: 'floor_no', type: 'smallint', unsigned: true, nullable: true })
  floorNo!: number | null;

  @Column({ name: 'total_floors', type: 'smallint', unsigned: true, nullable: true })
  totalFloors!: number | null;

  @Column({ name: 'carpet_area_sqft', type: 'decimal', precision: 12, scale: 2, nullable: true })
  carpetAreaSqft!: string | null;

  @Column({ name: 'builtup_area_sqft', type: 'decimal', precision: 12, scale: 2, nullable: true })
  builtupAreaSqft!: string | null;

  @Column({ name: 'super_builtup_area_sqft', type: 'decimal', precision: 12, scale: 2, nullable: true })
  superBuiltupAreaSqft!: string | null;

  @Column({ name: 'furnished_status', type: 'enum', enum: FurnishedStatus, nullable: true })
  furnishedStatus!: FurnishedStatus | null;

  @Column({ name: 'facing', type: 'enum', enum: FacingDirection, nullable: true })
  facing!: FacingDirection | null;

  @Column({ name: 'listing_mode', type: 'enum', enum: ListingMode, nullable: false, default: ListingMode.SALE })
  listingMode!: ListingMode;

  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  price!: string | null;

  @Column({ name: 'monthly_rent', type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthlyRent!: string | null;

  @Column({ name: 'security_deposit', type: 'decimal', precision: 12, scale: 2, nullable: true })
  securityDeposit!: string | null;

  @Column({ name: 'maintenance_fee', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maintenanceFee!: string | null;

  @Column({ name: 'available_from', type: 'date', nullable: true })
  availableFrom!: string | null;

  @Column({ name: 'status', type: 'enum', enum: PropertyUnitStatus, nullable: false, default: PropertyUnitStatus.AVAILABLE })
  status!: PropertyUnitStatus;

  @Column({ name: 'floor_plan_image_url', type: 'varchar', length: 1024, nullable: true })
  floorPlanImageUrl!: string | null;

  @Column({ name: 'floor_plan_image_key', type: 'varchar', length: 1024, nullable: true })
  floorPlanImageKey!: string | null;

  @Column({ name: 'is_primary', type: 'boolean', nullable: false, default: false })
  isPrimary!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt!: Date;

  @ManyToOne(() => Project, { lazy: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: Promise<Project>;
}
