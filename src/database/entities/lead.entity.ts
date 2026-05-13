import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Property } from './property.entity';
import { User } from './user.entity';

export enum LeadStatus {
  NEW = 'new',
  CONTACTED = 'contacted',
  CLOSED = 'closed',
}

@Entity('leads')
@Index('idx_leads_property_id', ['propertyId'])
@Index('idx_leads_user_id', ['userId'])
export class Lead {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'property_id', type: 'int', unsigned: true, nullable: false })
  propertyId!: number;

  @Column({ name: 'user_id', type: 'int', unsigned: true, nullable: true })
  userId!: number | null;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: false })
  email!: string;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: false })
  phone!: string;

  @Column({ name: 'message', type: 'text', nullable: false })
  message!: string;

  @Column({ name: 'status', type: 'enum', enum: LeadStatus, nullable: false })
  status!: LeadStatus;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => Property, (property) => property.leads, {
    lazy: true,
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'property_id', referencedColumnName: 'id' })
  property!: Promise<Property>;

  @ManyToOne(() => User, (user) => user.leads, {
    lazy: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user!: Promise<User | null>;
}
