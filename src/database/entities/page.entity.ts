import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PageSection } from './page-section.entity';
import { User } from './user.entity';

export enum PageStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum PageLayout {
  DEFAULT = 'default',
  LANDING = 'landing',
  LISTING = 'listing',
  BLOG = 'blog',
  CUSTOM = 'custom',
}

@Entity('pages')
@Unique('uq_pages_slug', ['slug'])
@Index('idx_pages_status', ['status'])
@Index('idx_pages_published_at', ['publishedAt'])
@Index('idx_pages_created_by', ['createdBy'])
@Index('idx_pages_updated_by', ['updatedBy'])
export class Page {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'slug', type: 'varchar', length: 255, nullable: false })
  slug!: string;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ name: 'excerpt', type: 'text', nullable: true })
  excerpt!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PageStatus,
    nullable: false,
    default: PageStatus.DRAFT,
  })
  status!: PageStatus;

  @Column({
    name: 'layout',
    type: 'enum',
    enum: PageLayout,
    nullable: false,
    default: PageLayout.DEFAULT,
  })
  layout!: PageLayout;

  @Column({ name: 'published_at', type: 'datetime', nullable: true })
  publishedAt!: Date | null;

  @Column({ name: 'created_by', type: 'int', unsigned: true, nullable: false })
  createdBy!: number;

  @Column({ name: 'updated_by', type: 'int', unsigned: true, nullable: true })
  updatedBy!: number | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  @ManyToOne(() => User, {
    lazy: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'created_by', referencedColumnName: 'id' })
  createdByUser!: Promise<User>;

  @ManyToOne(() => User, {
    lazy: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'updated_by', referencedColumnName: 'id' })
  updatedByUser!: Promise<User | null>;

  @OneToMany(() => PageSection, (pageSection) => pageSection.page, { lazy: true })
  pageSections!: Promise<PageSection[]>;
}
