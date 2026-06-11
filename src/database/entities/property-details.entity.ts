import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Property } from './property.entity';

@Entity('property_details')
@Index('uq_property_details_property_id', ['propertyId'], { unique: true })
export class PropertyDetails {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({
    name: 'property_id',
    type: 'int',
    unsigned: true,
    nullable: false,
    unique: true,
  })
  propertyId!: number;

  @Column({ name: 'bedrooms', type: 'int', nullable: false })
  bedrooms!: number;

  @Column({ name: 'bathrooms', type: 'int', nullable: false })
  bathrooms!: number;

  @Column({
    name: 'area_sqft',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: false,
  })
  areaSqft!: string;

  @Column({ name: 'parking', type: 'int', nullable: false })
  parking!: number;

  @Column({ name: 'furnished', type: 'boolean', nullable: false })
  furnished!: boolean;

  @Column({ name: 'balconies', type: 'int', default: 0 })
  balconies!: number;

  @Column({ name: 'floor_number', type: 'varchar', length: 50, nullable: true })
  floorNumber!: string | null;

  @Column({ name: 'total_floors', type: 'int', default: 0 })
  totalFloors!: number;

  @Column({ name: 'built_up_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  builtUpArea!: string | null;

  @Column({ name: 'carpet_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  carpetArea!: string | null;

  @Column({ name: 'super_built_up_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  superBuiltUpArea!: string | null;

  @Column({ name: 'plot_area', type: 'decimal', precision: 12, scale: 2, nullable: true })
  plotArea!: string | null;

  @Column({ name: 'area_unit', type: 'varchar', length: 50, default: 'Sq Ft' })
  areaUnit!: string;

  @Column({ name: 'property_facing', type: 'varchar', length: 50, nullable: true })
  propertyFacing!: string | null;

  @Column({ name: 'property_age', type: 'varchar', length: 50, nullable: true })
  propertyAge!: string | null;

  @Column({ name: 'possession_status', type: 'varchar', length: 50, nullable: true })
  possessionStatus!: string | null;

  @Column({ name: 'water_supply', type: 'varchar', length: 255, nullable: true })
  waterSupply!: string | null;

  @Column({ name: 'power_backup', type: 'varchar', length: 255, nullable: true })
  powerBackup!: string | null;

  @Column({ name: 'road_width', type: 'varchar', length: 100, nullable: true })
  roadWidth!: string | null;

  @Column({ name: 'open_sides', type: 'int', default: 0 })
  openSides!: number;

  @OneToOne(() => Property, (property) => property.propertyDetails, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;
}
