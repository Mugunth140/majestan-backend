import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Property } from './property.entity';

export interface SeoPageData {
  title?: string;
  description?: string;
  h1?: string;
  og_title?: string;
  og_description?: string;
  og_image?: string;
  robots?: string; // e.g., "index,follow" | "noindex,follow" | "noindex,nofollow"
  // Locality-specific extra content fields (collected but not rendered yet)
  content_overview?: string;
  content_connectivity?: string;
  content_education?: string;
  content_healthcare?: string;
  content_shopping?: string;
}

export interface PropertySeoData {
  overview?: SeoPageData;
  amenities?: SeoPageData;
  floor_plan?: SeoPageData;
  locality?: SeoPageData;
  photos?: SeoPageData;
  [key: string]: SeoPageData | undefined; // future-ready
}

@Entity('property_seo')
export class PropertySeo {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'property_id', type: 'int', unsigned: true, nullable: false, unique: true })
  propertyId!: number;

  @Column({ name: 'seo_data', type: 'json', nullable: false })
  seoData: PropertySeoData = {};

  @Column({ name: 'verification_status', type: 'varchar', length: 50, default: 'Pending' })
  verificationStatus!: string;

  @Column({ name: 'approval_status', type: 'varchar', length: 50, default: 'Pending' })
  approvalStatus!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt!: Date;

  @OneToOne(() => Property, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Property;
}
