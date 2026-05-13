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

export enum PropertyType {
  APARTMENT = 'apartment',
  VILLA = 'villa',
  PLOT = 'plot',
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
export class Property {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'title', type: 'varchar', length: 255, nullable: false })
  title!: string;

  @Column({ name: 'description', type: 'text', nullable: false })
  description!: string;

  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2, nullable: false })
  price!: string;

  @Column({ name: 'property_type', type: 'enum', enum: PropertyType, nullable: false })
  propertyType!: PropertyType;

  @Column({ name: 'status', type: 'enum', enum: PropertyStatus, nullable: false })
  status!: PropertyStatus;

  @Column({ name: 'owner_id', type: 'int', unsigned: true, nullable: false })
  ownerId!: number;

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

  @ManyToOne(() => User, (user) => user.properties, {
    lazy: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'owner_id', referencedColumnName: 'id' })
  owner!: Promise<User>;

  @OneToOne(() => PropertyDetails, (propertyDetails) => propertyDetails.property, { lazy: true })
  propertyDetails!: Promise<PropertyDetails>;

  @OneToMany(() => PropertyImage, (propertyImage) => propertyImage.property, { lazy: true })
  propertyImages!: Promise<PropertyImage[]>;

  @OneToMany(() => Lead, (lead) => lead.property, { lazy: true })
  leads!: Promise<Lead[]>;

  @OneToMany(() => Wishlist, (wishlist) => wishlist.property, { lazy: true })
  wishlists!: Promise<Wishlist[]>;
}
