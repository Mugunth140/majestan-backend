import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Lead } from './lead.entity';
import { PropertyDetails } from './property-details.entity';
import { PropertyImage } from './property-image.entity';
import { User } from './user.entity';
import { Wishlist } from './wishlist.entity';
import { PropertyLocation } from './property-location.entity';
import { PropertyAmenity } from './property-amenity.entity';
import { PropertyUnit } from './property-unit.entity';
import { PropertyFile } from './property-file.entity';
import { PropertyFaq } from './property-faq.entity';

export enum PropertyType {
  APARTMENT = 'apartment',
  VILLA = 'villa',
  PLOT = 'plot',
  COMMERCIAL = 'commercial',
  COWORKING = 'coworking',
  FARMLAND = 'farmland',
  INDUSTRIAL = 'industrial',
  OTHER = 'other',
  INDIVIDUAL_PORTION = 'individual_portion',
}

export enum PropertyStatus {
  AVAILABLE = 'available',
  SOLD = 'sold',
  RENTED = 'rented',
}

@Entity('properties')
@Index('idx_properties_city', ['city'])
@Index('idx_properties_price', ['price'])
@Index('idx_properties_status', ['status'])
@Index('idx_properties_owner_id', ['ownerId'])
@Index('idx_properties_property_code', ['propertyCode'], { unique: true })
@Index('idx_properties_slug', ['slug'], { unique: true })
export class Property {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({
    name: 'property_code',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  propertyCode!: string | null;

  @Column({ name: 'slug', type: 'varchar', length: 512, nullable: true })
  slug!: string | null;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: false })
  description!: string;

  @Column({
    name: 'price',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  price!: string | null;

  @Column({
    name: 'property_type',
    type: 'enum',
    enum: PropertyType,
    nullable: false,
  })
  propertyType!: PropertyType;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PropertyStatus,
    nullable: false,
  })
  status!: PropertyStatus;

  @Column({ name: 'owner_id', type: 'int', unsigned: true, nullable: true })
  ownerId!: number | null;

  @Column({ name: 'city', type: 'varchar', length: 255, nullable: false })
  city!: string;

  @Column({ name: 'state', type: 'varchar', length: 255, nullable: false })
  state!: string;

  @Column({ name: 'country', type: 'varchar', length: 255, nullable: false })
  country!: string;

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

  @ManyToOne('User', 'properties', {
    lazy: true,
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'owner_id', referencedColumnName: 'id' })
  owner!: Promise<User | null>;

  @OneToOne(
    'PropertyDetails',
    (propertyDetails: any) => propertyDetails.property,
    { lazy: true },
  )
  propertyDetails!: Promise<PropertyDetails>;

  @OneToMany('PropertyImage', (propertyImage: any) => propertyImage.property, {
    lazy: true,
  })
  propertyImages!: Promise<PropertyImage[]>;

  @OneToMany('Lead', (lead: any) => lead.property, { lazy: true })
  leads!: Promise<Lead[]>;

  @OneToMany('Wishlist', (wishlist: any) => wishlist.property, { lazy: true })
  wishlists!: Promise<Wishlist[]>;

  @OneToMany('PropertyLocation', (propertyLocation: any) => propertyLocation.property, { lazy: true })
  propertyLocations!: Promise<PropertyLocation[]>;

  @OneToMany('PropertyAmenity', (propertyAmenity: any) => propertyAmenity.property, { lazy: true })
  propertyAmenities!: Promise<PropertyAmenity[]>;

  @OneToMany('PropertyUnit', (propertyUnit: any) => propertyUnit.property, { lazy: true })
  propertyUnits!: Promise<PropertyUnit[]>;

  @OneToMany('PropertyFile', (propertyFile: any) => propertyFile.property, { lazy: true })
  propertyFiles!: Promise<PropertyFile[]>;

  @OneToMany('PropertyFaq', (propertyFaq: any) => propertyFaq.property, { lazy: true })
  faqs!: Promise<PropertyFaq[]>;
}
