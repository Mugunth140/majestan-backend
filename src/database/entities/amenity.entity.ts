import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { PropertyAmenity } from './property-amenity.entity';

export enum AmenityCategory {
  SECURITY = 'security',
  UTILITIES = 'utilities',
  RECREATION = 'recreation',
  COMMUNITY = 'community',
  CONNECTIVITY = 'connectivity',
  INTERIOR = 'interior',
  OTHER = 'other',
}

@Entity('amenities')
@Unique('uq_amenities_slug', ['slug'])
@Unique('uq_amenities_name', ['name'])
@Index('idx_amenities_category', ['category'])
@Index('idx_amenities_is_active', ['isActive'])
export class Amenity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 120, nullable: false })
  name!: string;

  @Column({ name: 'slug', type: 'varchar', length: 140, nullable: false })
  slug!: string;

  @Column({
    name: 'category',
    type: 'enum',
    enum: AmenityCategory,
    nullable: false,
    default: AmenityCategory.OTHER,
  })
  category!: AmenityCategory;

  @Column({ name: 'icon_url', type: 'varchar', length: 1024, nullable: true })
  iconUrl!: string | null;

  @Column({ name: 'icon_key', type: 'varchar', length: 1024, nullable: true })
  iconKey!: string | null;

  @Column({ name: 'is_active', type: 'boolean', nullable: false, default: true })
  isActive!: boolean;

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

  @OneToMany(() => PropertyAmenity, (propertyAmenity) => propertyAmenity.amenity, {
    lazy: true,
  })
  propertyAmenities!: Promise<PropertyAmenity[]>;
}
