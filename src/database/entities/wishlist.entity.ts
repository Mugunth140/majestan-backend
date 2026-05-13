import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Property } from './property.entity';
import { User } from './user.entity';

@Entity('wishlists')
@Unique('uq_wishlists_user_id_property_id', ['userId', 'propertyId'])
@Index('idx_wishlists_user_id', ['userId'])
@Index('idx_wishlists_property_id', ['propertyId'])
export class Wishlist {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'user_id', type: 'int', unsigned: true, nullable: false })
  userId!: number;

  @Column({ name: 'property_id', type: 'int', unsigned: true, nullable: false })
  propertyId!: number;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => User, (user) => user.wishlists, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user!: Promise<User>;

  @ManyToOne(() => Property, (property) => property.wishlists, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;
}
