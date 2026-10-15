import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Home-page sections curated from the CRM ("Showcases"). Each section holds
 * an ordered list of picks; `item_id` points at a property or a project
 * depending on the section.
 */
export enum ShowcaseSection {
  HandpickedProperties = 'handpicked_properties',
  FeaturedProjects = 'featured_projects',
}

/** What kind of record a section's `item_id` refers to. */
export const SHOWCASE_SECTION_KIND: Record<ShowcaseSection, 'property' | 'project'> = {
  [ShowcaseSection.HandpickedProperties]: 'property',
  [ShowcaseSection.FeaturedProjects]: 'project',
};

/** Upper bound per section, so the home carousels stay a sensible length. */
export const SHOWCASE_MAX_ITEMS = 20;

@Entity('showcase_items')
@Index('uq_showcase_items_section_item', ['section', 'itemId'], { unique: true })
@Index('idx_showcase_items_section_sort', ['section', 'sortOrder'])
export class ShowcaseItem {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'section', type: 'enum', enum: ShowcaseSection })
  section!: ShowcaseSection;

  @Column({ name: 'item_id', type: 'int', unsigned: true })
  itemId!: number;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt!: Date;
}
