import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity('utilities')
@Unique('uq_utilities_slug', ['slug'])
@Unique('uq_utilities_name', ['name'])
@Index('idx_utilities_is_active', ['isActive'])
export class Utility {
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
}
