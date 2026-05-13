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
import { PropertyLocation } from './property-location.entity';

@Entity('locations')
@Unique('uq_locations_hierarchy', [
  'countryCode',
  'stateName',
  'cityName',
  'localityName',
  'postalCode',
])
@Index('idx_locations_country_state_city', ['countryCode', 'stateName', 'cityName'])
@Index('idx_locations_locality', ['localityName'])
@Index('idx_locations_postal_code', ['postalCode'])
@Index('idx_locations_is_active', ['isActive'])
export class Location {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'country_code', type: 'char', length: 2, nullable: false })
  countryCode!: string;

  @Column({ name: 'country_name', type: 'varchar', length: 100, nullable: false })
  countryName!: string;

  @Column({ name: 'state_name', type: 'varchar', length: 100, nullable: false })
  stateName!: string;

  @Column({ name: 'city_name', type: 'varchar', length: 120, nullable: false })
  cityName!: string;

  @Column({ name: 'locality_name', type: 'varchar', length: 120, nullable: true })
  localityName!: string | null;

  @Column({ name: 'postal_code', type: 'varchar', length: 20, nullable: true })
  postalCode!: string | null;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude!: string | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude!: string | null;

  @Column({ name: 'timezone', type: 'varchar', length: 64, nullable: true })
  timezone!: string | null;

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

  @OneToMany(() => PropertyLocation, (propertyLocation) => propertyLocation.location, {
    lazy: true,
  })
  propertyLocations!: Promise<PropertyLocation[]>;
}
