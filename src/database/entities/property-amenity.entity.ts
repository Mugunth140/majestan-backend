import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { Amenity } from './amenity.entity';
import { Property } from './property.entity';

export enum PropertyAmenityAvailability {
  AVAILABLE = 'available',
  NOT_AVAILABLE = 'not_available',
  CHARGEABLE = 'chargeable',
}

@Entity('property_amenities')
@Index('idx_property_amenities_amenity_id', ['amenityId'])
@Index('idx_property_amenities_availability', ['availability'])
export class PropertyAmenity {
  @PrimaryColumn({ name: 'property_id', type: 'int', unsigned: true })
  propertyId!: number;

  @PrimaryColumn({ name: 'amenity_id', type: 'int', unsigned: true })
  amenityId!: number;

  @Column({
    name: 'availability',
    type: 'enum',
    enum: PropertyAmenityAvailability,
    nullable: false,
    default: PropertyAmenityAvailability.AVAILABLE,
  })
  availability!: PropertyAmenityAvailability;

  @Column({ name: 'notes', type: 'varchar', length: 255, nullable: true })
  notes!: string | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => Property, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;

  @ManyToOne(() => Amenity, (amenity) => amenity.propertyAmenities, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'amenity_id', referencedColumnName: 'id' })
  amenity!: Promise<Amenity>;
}
