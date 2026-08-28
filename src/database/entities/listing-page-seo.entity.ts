import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('listing_page_seo')
export class ListingPageSeo {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Index('idx_listing_page_seo_page_key', { unique: true })
  @Column({ name: 'page_key', type: 'varchar', length: 512, nullable: false })
  pageKey!: string;

  @Column({ name: 'meta_title', type: 'varchar', length: 255, nullable: true })
  metaTitle!: string | null;

  @Column({ name: 'meta_description', type: 'varchar', length: 320, nullable: true })
  metaDescription!: string | null;

  @Column({ name: 'h1', type: 'varchar', length: 255, nullable: true })
  h1!: string | null;

  @Column({ name: 'og_title', type: 'varchar', length: 255, nullable: true })
  ogTitle!: string | null;

  @Column({ name: 'og_description', type: 'varchar', length: 320, nullable: true })
  ogDescription!: string | null;

  @Column({ name: 'og_image_url', type: 'varchar', length: 1024, nullable: true })
  ogImageUrl!: string | null;

  @Column({ name: 'robots_index', type: 'tinyint', default: 1 })
  robotsIndex!: number;

  @Column({ name: 'robots_follow', type: 'tinyint', default: 1 })
  robotsFollow!: number;

  @Column({ name: 'custom_content', type: 'text', nullable: true })
  customContent!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt!: Date;
}
