import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Property } from './property.entity';

export enum PropertyUnitType {
  STUDIO = 'studio',
  ONE_BHK = '1bhk',
  TWO_BHK = '2bhk',
  THREE_BHK = '3bhk',
  FOUR_BHK = '4bhk',
  PENTHOUSE = 'penthouse',
  VILLA_UNIT = 'villa_unit',
  PLOT_UNIT = 'plot_unit',
  OFFICE_UNIT = 'office_unit',
  SHOP_UNIT = 'shop_unit',
  WAREHOUSE_UNIT = 'warehouse_unit',
  OTHER = 'other',
}

export enum FurnishedStatus {
  UNFURNISHED = 'unfurnished',
  SEMI_FURNISHED = 'semi_furnished',
  FULLY_FURNISHED = 'fully_furnished',
}

export enum FacingDirection {
  NORTH = 'north',
  SOUTH = 'south',
  EAST = 'east',
  WEST = 'west',
  NORTH_EAST = 'north_east',
  NORTH_WEST = 'north_west',
  SOUTH_EAST = 'south_east',
  SOUTH_WEST = 'south_west',
}

export enum ListingMode {
  SALE = 'sale',
  RENT = 'rent',
}

export enum PropertyUnitStatus {
  AVAILABLE = 'available',
  RESERVED = 'reserved',
  SOLD = 'sold',
  RENTED = 'rented',
  INACTIVE = 'inactive',
}

@Entity('property_units')
@Unique('uq_property_units_property_unit_code', ['propertyId', 'unitCode'])
@Index('idx_property_units_property_id', ['propertyId'])
@Index('idx_property_units_status', ['status'])
@Index('idx_property_units_unit_type', ['unitType'])
@Index('idx_property_units_price', ['price'])
@Index('idx_property_units_monthly_rent', ['monthlyRent'])
@Index('idx_property_units_bed_bath', ['bedrooms', 'bathrooms'])
@Index('idx_property_units_property_status_mode', ['propertyId', 'status', 'listingMode'])
export class PropertyUnit {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'property_id', type: 'int', unsigned: true, nullable: false })
  propertyId!: number;

  @Column({ name: 'unit_code', type: 'varchar', length: 64, nullable: false })
  unitCode!: string;

  @Column({ name: 'title', type: 'varchar', length: 150, nullable: true })
  title!: string | null;

  @Column({
    name: 'unit_type',
    type: 'enum',
    enum: PropertyUnitType,
    nullable: false,
    default: PropertyUnitType.OTHER,
  })
  unitType!: PropertyUnitType;

  @Column({ name: 'bedrooms', type: 'tinyint', unsigned: true, nullable: true })
  bedrooms!: number | null;

  @Column({ name: 'bathrooms', type: 'tinyint', unsigned: true, nullable: true })
  bathrooms!: number | null;

  @Column({ name: 'balconies', type: 'tinyint', unsigned: true, nullable: true })
  balconies!: number | null;

  @Column({ name: 'floor_no', type: 'smallint', unsigned: true, nullable: true })
  floorNo!: number | null;

  @Column({ name: 'total_floors', type: 'smallint', unsigned: true, nullable: true })
  totalFloors!: number | null;

  @Column({ name: 'carpet_area_sqft', type: 'decimal', precision: 12, scale: 2, nullable: true })
  carpetAreaSqft!: string | null;

  @Column({ name: 'builtup_area_sqft', type: 'decimal', precision: 12, scale: 2, nullable: true })
  builtupAreaSqft!: string | null;

  @Column({
    name: 'super_builtup_area_sqft',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  superBuiltupAreaSqft!: string | null;

  @Column({
    name: 'furnished_status',
    type: 'enum',
    enum: FurnishedStatus,
    nullable: true,
  })
  furnishedStatus!: FurnishedStatus | null;

  @Column({ name: 'facing', type: 'enum', enum: FacingDirection, nullable: true })
  facing!: FacingDirection | null;

  @Column({ name: 'listing_mode', type: 'enum', enum: ListingMode, nullable: false })
  listingMode!: ListingMode;

  @Column({ name: 'price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  price!: string | null;

  @Column({ name: 'monthly_rent', type: 'decimal', precision: 12, scale: 2, nullable: true })
  monthlyRent!: string | null;

  @Column({
    name: 'security_deposit',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
  })
  securityDeposit!: string | null;

  @Column({ name: 'maintenance_fee', type: 'decimal', precision: 12, scale: 2, nullable: true })
  maintenanceFee!: string | null;

  @Column({ name: 'available_from', type: 'date', nullable: true })
  availableFrom!: string | null;

  @Column({
    name: 'status',
    type: 'enum',
    enum: PropertyUnitStatus,
    nullable: false,
    default: PropertyUnitStatus.AVAILABLE,
  })
  status!: PropertyUnitStatus;

  @Column({ name: 'is_primary', type: 'boolean', nullable: false, default: false })
  isPrimary!: boolean;

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

  @ManyToOne(() => Property, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;
}
