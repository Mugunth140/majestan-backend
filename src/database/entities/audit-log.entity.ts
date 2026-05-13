import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  PUBLISH = 'publish',
  LOGIN = 'login',
  LOGOUT = 'logout',
  ASSIGN = 'assign',
  APPROVE = 'approve',
  REJECT = 'reject',
  EXPORT = 'export',
}

@Entity('audit_logs')
@Index('idx_audit_logs_actor_user_id', ['actorUserId'])
@Index('idx_audit_logs_entity', ['entityType', 'entityId'])
@Index('idx_audit_logs_action', ['action'])
@Index('idx_audit_logs_created_at', ['createdAt'])
@Index('idx_audit_logs_request_id', ['requestId'])
export class AuditLog {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'actor_user_id', type: 'int', unsigned: true, nullable: true })
  actorUserId!: number | null;

  @Column({ name: 'action', type: 'enum', enum: AuditAction, nullable: false })
  action!: AuditAction;

  @Column({ name: 'entity_type', type: 'varchar', length: 50, nullable: false })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'int', unsigned: true, nullable: true })
  entityId!: number | null;

  @Column({ name: 'request_id', type: 'char', length: 36, nullable: true })
  requestId!: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress!: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent!: string | null;

  @Column({ name: 'changes_json', type: 'json', nullable: true })
  changesJson!: Record<string, unknown> | null;

  @Column({ name: 'metadata_json', type: 'json', nullable: true })
  metadataJson!: Record<string, unknown> | null;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamp',
    nullable: false,
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @ManyToOne(() => User, {
    lazy: true,
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'actor_user_id', referencedColumnName: 'id' })
  actorUser!: Promise<User | null>;
}
