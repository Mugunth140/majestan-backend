import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('builders')
@Index('idx_builders_slug', ['slug'], { unique: true })
export class Builder {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ name: 'slug', type: 'varchar', length: 255, nullable: false, unique: true })
  slug!: string;

  @Column({ name: 'logo_url', type: 'varchar', length: 1024, nullable: true })
  logoUrl!: string | null;

  @Column({ name: 'phone', type: 'varchar', length: 30, nullable: true })
  phone!: string | null;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: true })
  email!: string | null;

  @Column({ name: 'website', type: 'varchar', length: 255, nullable: true })
  website!: string | null;

  @Column({ name: 'experience_years', type: 'int', unsigned: true, nullable: true })
  experienceYears!: number | null;

  @Column({ name: 'completed_projects', type: 'int', unsigned: true, nullable: true, default: 0 })
  completedProjects!: number | null;

  @Column({ name: 'ongoing_projects', type: 'int', unsigned: true, nullable: true, default: 0 })
  ongoingProjects!: number | null;

  @Column({ name: 'description', type: 'text', nullable: true })
  description!: string | null;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @CreateDateColumn({
    name: 'created_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'datetime',
    precision: 6,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt!: Date;

  @OneToMany(() => Project, (project) => project.builder)
  projects!: Project[];
}
