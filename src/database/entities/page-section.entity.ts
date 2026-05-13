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
import { Page } from './page.entity';

export enum PageSectionType {
  HERO = 'hero',
  RICH_TEXT = 'rich_text',
  GALLERY = 'gallery',
  STATS = 'stats',
  FAQ = 'faq',
  CTA = 'cta',
  FORM = 'form',
  CUSTOM = 'custom',
}

@Entity('page_sections')
@Unique('uq_page_sections_page_key', ['pageId', 'sectionKey'])
@Index('idx_page_sections_page_id', ['pageId'])
@Index('idx_page_sections_type', ['sectionType'])
@Index('idx_page_sections_sort_order', ['sortOrder'])
@Index('idx_page_sections_enabled', ['isEnabled'])
export class PageSection {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'page_id', type: 'int', unsigned: true, nullable: false })
  pageId!: number;

  @Column({ name: 'section_key', type: 'varchar', length: 120, nullable: false })
  sectionKey!: string;

  @Column({ name: 'section_type', type: 'enum', enum: PageSectionType, nullable: false })
  sectionType!: PageSectionType;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: true })
  title!: string | null;

  @Column({ name: 'content', type: 'text', nullable: true })
  content!: string | null;

  @Column({ name: 'config_json', type: 'json', nullable: true })
  configJson!: Record<string, unknown> | null;

  @Column({ name: 'file_url', type: 'varchar', length: 1024, nullable: true })
  fileUrl!: string | null;

  @Column({ name: 'file_key', type: 'varchar', length: 1024, nullable: true })
  fileKey!: string | null;

  @Column({ name: 'sort_order', type: 'int', unsigned: true, nullable: false, default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_enabled', type: 'boolean', nullable: false, default: true })
  isEnabled!: boolean;

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

  @ManyToOne(() => Page, (page) => page.pageSections, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'page_id', referencedColumnName: 'id' })
  page!: Promise<Page>;
}
