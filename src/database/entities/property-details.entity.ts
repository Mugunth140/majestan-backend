import { Column, Entity, Index, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Property } from './property.entity';

@Entity('property_details')
@Index('uq_property_details_property_id', ['propertyId'], { unique: true })
export class PropertyDetails {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'property_id', type: 'int', unsigned: true, nullable: false, unique: true })
  propertyId!: number;

  @Column({ name: 'bedrooms', type: 'int', nullable: false })
  bedrooms!: number;

  @Column({ name: 'bathrooms', type: 'int', nullable: false })
  bathrooms!: number;

  @Column({ name: 'area_sqft', type: 'decimal', precision: 12, scale: 2, nullable: false })
  areaSqft!: string;

  @Column({ name: 'parking', type: 'int', nullable: false })
  parking!: number;

  @Column({ name: 'furnished', type: 'boolean', nullable: false })
  furnished!: boolean;

  @OneToOne(() => Property, (property) => property.propertyDetails, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;
}
