import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Blog } from './blog.entity';
import { Lead } from './lead.entity';
import { Property } from './property.entity';
import { Wishlist } from './wishlist.entity';

export enum UserRole {
  ADMIN = 'admin',
  STAFF = 'staff',
  USER = 'user',
}

@Entity('users')
@Unique('uq_users_email', ['email'])
export class User {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: false })
  name!: string;

  @Column({ name: 'email', type: 'varchar', length: 255, nullable: false })
  email!: string;

  @Column({ name: 'phone', type: 'varchar', length: 50, nullable: false })
  phone!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    nullable: false,
  })
  passwordHash!: string;

  @Column({ name: 'role', type: 'enum', enum: UserRole, nullable: false })
  role!: UserRole;

  @Column({
    name: 'is_verified',
    type: 'boolean',
    nullable: false,
    default: false,
  })
  isVerified!: boolean;

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

  @OneToMany('Property', (property: any) => property.owner, { lazy: true })
  properties!: Promise<Property[]>;

  @OneToMany('Lead', (lead: any) => lead.user, { lazy: true })
  leads!: Promise<Lead[]>;

  @OneToMany('Wishlist', (wishlist: any) => wishlist.user, { lazy: true })
  wishlists!: Promise<Wishlist[]>;

  @OneToMany('Blog', (blog: any) => blog.author, { lazy: true })
  blogs!: Promise<Blog[]>;
}
