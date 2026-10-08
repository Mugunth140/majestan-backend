import {
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { FurnishingItem } from './furnishing-item.entity';
import { Property } from './property.entity';

@Entity('property_furnishings')
@Index('idx_property_furnishings_item_id', ['furnishingItemId'])
export class PropertyFurnishing {
  @PrimaryColumn({ name: 'property_id', type: 'int', unsigned: true })
  propertyId!: number;

  @PrimaryColumn({ name: 'furnishing_item_id', type: 'int', unsigned: true })
  furnishingItemId!: number;

  @ManyToOne('Property', (property: any) => property.propertyFurnishings, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;

  @ManyToOne('FurnishingItem', (furnishingItem: any) => furnishingItem.propertyFurnishings, {
    lazy: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'furnishing_item_id', referencedColumnName: 'id' })
  furnishingItem!: Promise<FurnishingItem>;
}
