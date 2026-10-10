import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('project_faqs')
@Index('idx_project_faqs_project_id', ['projectId'])
export class ProjectFaq {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'project_id', type: 'int', unsigned: true, nullable: false })
  projectId!: number;

  @Column({ name: 'question', type: 'varchar', length: 500, nullable: false })
  question!: string;

  @Column({ name: 'answer', type: 'text', nullable: false })
  answer!: string;

  @Column({ name: 'sort_order', type: 'int', nullable: false, default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', nullable: false, default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt!: Date;

  @ManyToOne(() => Project, { lazy: true, nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id', referencedColumnName: 'id' })
  project!: Promise<Project>;
}
