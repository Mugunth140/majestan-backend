import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Property } from './property.entity';

@Entity('property_faqs')
@Index('idx_property_faqs_property_id', ['propertyId'])
export class PropertyFaq {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'property_id', type: 'int', unsigned: true, nullable: false })
  propertyId!: number;

  @Column({ name: 'question', type: 'varchar', length: 500, nullable: false })
  question!: string;

  @Column({ name: 'answer', type: 'text', nullable: false })
  answer!: string;

  @Column({ name: 'section', type: 'varchar', length: 100, nullable: false, default: 'overview' })
  section!: string;

  @Column({
    name: 'sort_order',
    type: 'int',
    unsigned: true,
    nullable: false,
    default: 0,
  })
  sortOrder!: number;

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

  @ManyToOne(() => Property, (property) => property.faqs, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;
}
