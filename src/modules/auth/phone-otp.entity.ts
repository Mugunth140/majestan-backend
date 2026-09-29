// site/majestan-backend/src/modules/auth/phone-otp.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OtpPurpose } from './otp-purpose.enum';

@Entity('phone_otps')
@Index('idx_phone_otps_phone_purpose_created', ['phone', 'purpose', 'createdAt'])
export class PhoneOtp {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'phone', type: 'varchar', length: 20, nullable: false })
  phone!: string;

  @Column({ name: 'purpose', type: 'enum', enum: OtpPurpose, nullable: false })
  purpose!: OtpPurpose;

  @Column({ name: 'otp_hash', type: 'varchar', length: 255, nullable: false })
  otpHash!: string;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6, nullable: false })
  expiresAt!: Date;

  @Column({ name: 'attempts', type: 'int', unsigned: true, nullable: false, default: 0 })
  attempts!: number;

  @Column({ name: 'used_at', type: 'datetime', precision: 6, nullable: true })
  usedAt!: Date | null;

  @Column({ name: 'superseded_at', type: 'datetime', precision: 6, nullable: true })
  supersededAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp', precision: 6, nullable: false, default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp', precision: 6, nullable: false, default: () => 'CURRENT_TIMESTAMP(6)', onUpdate: 'CURRENT_TIMESTAMP(6)' })
  updatedAt!: Date;
}
