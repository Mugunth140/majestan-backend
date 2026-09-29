// site/majestan-backend/src/modules/auth/otp.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { compare, hash } from 'bcrypt';
import { DataSource } from 'typeorm';
import { generateOtp } from '../../common/utils/otp-generator.util';
import { maskPhone } from '../../common/utils/phone.util';
import { SmsService } from '../sms/sms.service';
import { OtpPurpose } from './otp-purpose.enum';
import { PhoneOtp } from './phone-otp.entity';

export const REGISTER_TTL_SECONDS = 900;
export const LOGIN_TTL_SECONDS = 300;
export const MAX_VERIFY_ATTEMPTS = 5;
export const RESEND_MIN_SECONDS = 60;
export const RESEND_HOURLY_LIMIT = 5;

export class OtpHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'OtpHttpError';
  }
}

@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly smsService: SmsService,
    private readonly configService: ConfigService,
  ) {}

  async requestOtp(args: { canonical: string; providerNumber: string; purpose: OtpPurpose }): Promise<{ expiresInSeconds: number }> {
    const ttl = args.purpose === OtpPurpose.REGISTER ? REGISTER_TTL_SECONDS : LOGIN_TTL_SECONDS;
    await this.enforceResendLimits(args.canonical, args.purpose);
    const otp = generateOtp();
    await this.smsService.sendOtp({ providerNumber: args.providerNumber, purpose: args.purpose, otp });
    const rounds = this.configService.getOrThrow<number>('auth.saltRounds');
    const otpHash = await hash(otp, rounds);
    const expiresAt = new Date(Date.now() + ttl * 1000);
    await this.dataSource.createQueryBuilder().update(PhoneOtp)
      .set({ supersededAt: new Date() })
      .where('phone = :phone', { phone: args.canonical })
      .andWhere('purpose = :purpose', { purpose: args.purpose })
      .andWhere('usedAt IS NULL')
      .andWhere('supersededAt IS NULL')
      .execute();
    await this.dataSource.createQueryBuilder().insert().into(PhoneOtp)
      .values({ phone: args.canonical, purpose: args.purpose, otpHash, expiresAt, attempts: 0, usedAt: null, supersededAt: null })
      .execute();
    this.logger.log(`OTP issued purpose=${args.purpose} phone=${maskPhone(args.canonical)} ttl=${ttl}`);
    return { expiresInSeconds: ttl };
  }

  async verifyOtp(args: { canonical: string; purpose: OtpPurpose; otp: string }): Promise<{ otpId: number }> {
    const row = await this.dataSource.createQueryBuilder()
      .select('otp.*').from(PhoneOtp, 'otp')
      .where('otp.phone = :phone', { phone: args.canonical })
      .andWhere('otp.purpose = :purpose', { purpose: args.purpose })
      .andWhere('otp.supersededAt IS NULL')
      .orderBy('otp.createdAt', 'DESC').limit(1)
      .getRawOne<PhoneOtp & { id: number }>();
    if (!row) throw new OtpHttpError(404, 'OTP_NOT_FOUND', 'No OTP request found');
    if (row.usedAt) throw new OtpHttpError(410, 'OTP_EXPIRED', 'OTP already used');
    if (row.expiresAt.getTime() < Date.now()) throw new OtpHttpError(410, 'OTP_EXPIRED', 'OTP expired');
    if (Number(row.attempts) >= MAX_VERIFY_ATTEMPTS) throw new OtpHttpError(410, 'OTP_LOCKED', 'Too many attempts');
    const ok = await compare(args.otp, row.otpHash);
    if (!ok) {
      await this.dataSource.createQueryBuilder().update(PhoneOtp)
        .set({ attempts: Number(row.attempts) + 1 })
        .where('id = :id', { id: row.id }).execute();
      const locked = Number(row.attempts) + 1 >= MAX_VERIFY_ATTEMPTS;
      throw new OtpHttpError(locked ? 410 : 401, locked ? 'OTP_LOCKED' : 'INVALID_OTP', locked ? 'Too many attempts' : 'Invalid OTP');
    }
    await this.dataSource.createQueryBuilder().update(PhoneOtp)
      .set({ usedAt: new Date() })
      .where('id = :id', { id: row.id }).execute();
    return { otpId: Number(row.id) };
  }

  private async enforceResendLimits(canonical: string, purpose: OtpPurpose): Promise<void> {
    const latest = await this.dataSource.createQueryBuilder()
      .select('otp.*').from(PhoneOtp, 'otp')
      .where('otp.phone = :phone', { phone: canonical })
      .andWhere('otp.purpose = :purpose', { purpose })
      .orderBy('otp.createdAt', 'DESC').limit(1)
      .getRawOne<PhoneOtp>();
    if (latest && Date.now() - new Date(latest.createdAt).getTime() < RESEND_MIN_SECONDS * 1000) {
      throw new OtpHttpError(429, 'OTP_RATE_LIMITED', 'Please wait before requesting another OTP');
    }
    const since = new Date(Date.now() - 3600_000);
    const recent = await this.dataSource.createQueryBuilder()
      .select('COUNT(*) as cnt').from(PhoneOtp, 'otp')
      .where('otp.phone = :phone', { phone: canonical })
      .andWhere('otp.purpose = :purpose', { purpose })
      .andWhere('otp.createdAt >= :since', { since })
      .getRawOne<{ cnt: string }>();
    if (recent && Number(recent.cnt) >= RESEND_HOURLY_LIMIT) {
      throw new OtpHttpError(429, 'OTP_RATE_LIMITED', 'Too many OTP requests');
    }
  }
}
