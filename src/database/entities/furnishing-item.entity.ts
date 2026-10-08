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
import { PropertyFurnishing } from './property-furnishing.entity';

@Entity('furnishing_items')
@Unique('uq_furnishing_items_slug', ['slug'])
@Unique('uq_furnishing_items_name', ['name'])
@Index('idx_furnishing_items_is_active', ['isActive'])
export class FurnishingItem {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 120, nullable: false })
  name!: string;

  @Column({ name: 'slug', type: 'varchar', length: 140, nullable: false })
  slug!: string;

  @Column({ name: 'icon', type: 'varchar', length: 100, nullable: true })
  icon!: string | null;

  @Column({
    name: 'is_active',
    type: 'boolean',
    nullable: false,
    default: true,
  })
  isActive!: boolean;

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

  @OneToMany('PropertyFurnishing', (propertyFurnishing: any) => propertyFurnishing.furnishingItem, {
    lazy: true,
  })
  propertyFurnishings!: Promise<PropertyFurnishing[]>;
}
