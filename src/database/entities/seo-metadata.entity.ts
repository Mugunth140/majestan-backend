import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export enum SeoEntityType {
  PROPERTY = 'property',
  BLOG = 'blog',
  PAGE = 'page',
}

@Entity('seo_metadata')
@Unique('uq_seo_metadata_entity', ['entityType', 'entityId'])
@Unique('uq_seo_metadata_slug', ['slug'])
@Index('idx_seo_metadata_entity', ['entityType', 'entityId'])
@Index('idx_seo_metadata_slug', ['slug'])
export class SeoMetadata {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'entity_type', type: 'enum', enum: SeoEntityType, nullable: false })
  entityType!: SeoEntityType;

  @Column({ name: 'entity_id', type: 'int', unsigned: true, nullable: false })
  entityId!: number;

  @Column({ name: 'slug', type: 'varchar', length: 255, nullable: false })
  slug!: string;

  @Column({ name: 'meta_title', type: 'varchar', length: 255, nullable: true })
  metaTitle!: string | null;

  @Column({ name: 'meta_description', type: 'varchar', length: 320, nullable: true })
  metaDescription!: string | null;

  @Column({ name: 'meta_keywords', type: 'varchar', length: 500, nullable: true })
  metaKeywords!: string | null;

  @Column({ name: 'canonical_url', type: 'varchar', length: 1024, nullable: true })
  canonicalUrl!: string | null;

  @Column({ name: 'og_title', type: 'varchar', length: 255, nullable: true })
  ogTitle!: string | null;

  @Column({ name: 'og_description', type: 'varchar', length: 320, nullable: true })
  ogDescription!: string | null;

  @Column({ name: 'og_image_url', type: 'varchar', length: 1024, nullable: true })
  ogImageUrl!: string | null;

  @Column({ name: 'og_image_key', type: 'varchar', length: 1024, nullable: true })
  ogImageKey!: string | null;

  @Column({ name: 'robots_index', type: 'boolean', nullable: false, default: true })
  robotsIndex!: boolean;

  @Column({ name: 'robots_follow', type: 'boolean', nullable: false, default: true })
  robotsFollow!: boolean;

  @Column({ name: 'schema_json', type: 'json', nullable: true })
  schemaJson!: Record<string, unknown> | null;

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
}
