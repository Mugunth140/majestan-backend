import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Location } from './location.entity';
import { Property } from './property.entity';

@Entity('property_locations')
@Index('idx_property_locations_location_id', ['locationId'])
@Index('idx_property_locations_lat_lng', ['latitude', 'longitude'])
export class PropertyLocation {
  @PrimaryColumn({ name: 'property_id', type: 'int', unsigned: true })
  propertyId!: number;

  @Column({ name: 'location_id', type: 'int', unsigned: true, nullable: false })
  locationId!: number;

  @Column({ name: 'landmark', type: 'varchar', length: 255, nullable: true })
  landmark!: string | null;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

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

  @OneToOne(() => Property, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;

  @ManyToOne(() => Location, (location) => location.propertyLocations, {
    lazy: true,
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'location_id', referencedColumnName: 'id' })
  location!: Promise<Location>;
}
