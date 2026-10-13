import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Owner self-post drafts. One row per verified phone; the payload is schemaless
 * JSON so the public form can evolve without migrations. A submitted draft
 * becomes a Pending property and the row is deleted.
 */
@Entity('property_drafts')
export class PropertyDraft {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: false, unique: true })
  phone!: string;

  @Column({ name: 'payload', type: 'json', nullable: false })
  payload!: Record<string, unknown>;

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
