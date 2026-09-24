import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AdPlacement {
  Hero = 'hero',
  ListingFeed = 'listing_feed',
  Announcement = 'announcement',
  Popup = 'popup',
}

export enum AdLinkType {
  Preset = 'preset',
  Custom = 'custom',
}

@Entity('ads')
@Index('idx_ads_placement_active_sort', ['placement', 'isActive', 'sortOrder'])
export class Ad {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'placement', type: 'enum', enum: AdPlacement, default: AdPlacement.Hero })
  placement!: AdPlacement;

  @Column({ name: 'title', type: 'varchar', length: 120 })
  title!: string;

  @Column({ name: 'desktop_image_key', type: 'varchar', length: 500 })
  desktopImageKey!: string;

  @Column({ name: 'mobile_image_key', type: 'varchar', length: 500 })
  mobileImageKey!: string;

  @Column({ name: 'link_type', type: 'enum', enum: AdLinkType, default: AdLinkType.Preset })
  linkType!: AdLinkType;

  @Column({ name: 'link_preset', type: 'varchar', length: 80, nullable: true })
  linkPreset!: string | null;

  @Column({ name: 'link_custom', type: 'varchar', length: 500, nullable: true })
  linkCustom!: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_active', type: 'tinyint', width: 1, default: 1 })
  isActive!: boolean;

  @Column({ name: 'created_by', type: 'varchar', length: 120, nullable: true })
  createdBy!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp' })
  updatedAt!: Date;
}
