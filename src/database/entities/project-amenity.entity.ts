import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Amenity } from './amenity.entity';
import { Project } from './project.entity';

export enum ProjectAmenityAvailability {
  AVAILABLE = 'available',
  NOT_AVAILABLE = 'not_available',
  CHARGEABLE = 'chargeable',
}

@Entity('project_amenities')
@Index('idx_project_amenities_amenity_id', ['amenityId'])
@Index('idx_project_amenities_availability', ['availability'])
export class ProjectAmenity {
  @PrimaryColumn({ name: 'project_id', type: 'int', unsigned: true })
  projectId!: number;

  @PrimaryColumn({ name: 'amenity_id', type: 'int', unsigned: true })
  amenityId!: number;

  @Column({
    name: 'availability',
    type: 'enum',
    enum: ProjectAmenityAvailability,
    nullable: false,
    default: ProjectAmenityAvailability.AVAILABLE,
  })
  availability!: ProjectAmenityAvailability;

  @Column({ name: 'notes', type: 'varchar', length: 255, nullable: true })
  notes!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt!: Date;

  @ManyToOne(() => Project, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: Promise<Project>;

  @ManyToOne(() => Amenity, (amenity) => amenity.projectAmenities, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'amenity_id', referencedColumnName: 'id' })
  amenity!: Promise<Amenity>;
}
