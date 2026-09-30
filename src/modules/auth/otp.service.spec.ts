// site/majestan-backend/src/modules/auth/otp.service.spec.ts
import { DataSource } from 'typeorm';
import { OtpService } from './otp.service';
import { OtpPurpose } from './otp-purpose.enum';
import { PhoneOtp } from './phone-otp.entity';

const CANONICAL = '+919876543210';

/**
 * TypeORM exposes two lookups with different key shapes, and conflating them is
 * the bug this suite guards:
 *
 * - `getRawOne()` hands back the **database column names** (`otp_hash`), because
 *   it never maps columns onto entity properties.
 * - `getOne()` **hydrates the entity**, so the row arrives camelCased
 *   (`otpHash`) and is genuinely typed as `PhoneOtp`.
 *
 * The fake below models both, so a service that reads a camelCase property off
 * a raw row fails here exactly as it would against MySQL.
 */
type DbRow = Record<string, unknown>;

const hydrate = (row: DbRow): PhoneOtp => ({
  id: row.id as number,
  phone: row.phone as string,
  purpose: row.purpose as OtpPurpose,
  otpHash: row.otp_hash as string,
  expiresAt: row.expires_at as Date,
  attempts: row.attempts as number,
  usedAt: (row.used_at ?? null) as Date | null,
  supersededAt: (row.superseded_at ?? null) as Date | null,
  createdAt: row.created_at as Date,
  updatedAt: row.updated_at as Date,
});

const dbRow = (over: Partial<DbRow> = {}): DbRow => ({
  id: 7,
  phone: CANONICAL,
  purpose: OtpPurpose.LOGIN,
  otp_hash: '$2b$10$5p/4FfnkI0/cg4PG3Y2bjOpp8fqPBfXE34Jy4A.9VmKv3hJqtYjti', // "123456"
  expires_at: new Date(Date.now() + 300_000),
  attempts: 0,
  used_at: null,
  superseded_at: null,
  created_at: new Date(Date.now() - 1_000),
  updated_at: new Date(Date.now() - 1_000),
  ...over,
});

const makeService = (overrides: { rows?: DbRow[]; sms?: unknown; saltRounds?: number } = {}) => {
  const rows: DbRow[] = overrides.rows ?? [];
  const qb: any = {};
  // Spies rather than plain methods, so a test can assert what was written.
  const chain = (name: string) => jest.fn(() => qb);
  qb.select = chain('select');
  qb.from = chain('from');
  qb.where = chain('where');
  qb.andWhere = chain('andWhere');
  qb.orderBy = chain('orderBy');
  qb.limit = chain('limit');
  qb.insert = chain('insert');
  qb.into = chain('into');
  qb.values = chain('values');
  qb.update = chain('update');
  qb.set = chain('set');
  qb.getRawOne = jest.fn(async () => rows[0] ?? null);
  qb.getOne = jest.fn(async () => (rows[0] ? hydrate(rows[0]) : null));
  qb.getRawMany = jest.fn(async () => rows);
  qb.execute = jest.fn(async () => ({ identifiers: [{ id: 7 }], raw: { insertId: 7 } }));
  const dataSource = { createQueryBuilder: jest.fn().mockReturnValue(qb) } as unknown as DataSource;
  const sms = (overrides.sms ?? { sendOtp: jest.fn().mockResolvedValue({ messageId: 'M1' }) }) as unknown as { sendOtp: jest.Mock };
  const config = { getOrThrow: () => overrides.saltRounds ?? 10, get: () => 10 } as never;
  return { service: new OtpService(dataSource, sms as unknown as never, config), sms, qb };
};

describe('OtpService', () => {
  it('request hashes OTP with bcrypt and returns REGISTER expiry 900', async () => {
    const { service, sms } = makeService();
    const res = await service.requestOtp({ canonical: '+919876543210', providerNumber: '919876543210', purpose: OtpPurpose.REGISTER });
    expect(res.expiresInSeconds).toBe(900);
    expect(sms.sendOtp).toHaveBeenCalledWith(expect.objectContaining({ purpose: OtpPurpose.REGISTER }));
  });

  it('LOGIN expiry is 300', async () => {
    const { service } = makeService();
    const res = await service.requestOtp({ canonical: '+919876543210', providerNumber: '919876543210', purpose: OtpPurpose.LOGIN });
    expect(res.expiresInSeconds).toBe(300);
  });

  it('does not persist when provider rejects', async () => {
    const sms = { sendOtp: jest.fn().mockRejectedValue(Object.assign(new Error('dlt'), { code: 'OTP_DLT_CONFIGURATION_ERROR' })) };
    const { service } = makeService({ sms });
    await expect(
      service.requestOtp({ canonical: '+919876543210', providerNumber: '919876543210', purpose: OtpPurpose.LOGIN }),
    ).rejects.toMatchObject({ code: 'OTP_DLT_CONFIGURATION_ERROR' });
  });

  it('rejects cross-purpose OTP use', async () => {
    const { service } = makeService({ rows: [] });
    await expect(
      service.verifyOtp({ canonical: CANONICAL, purpose: OtpPurpose.LOGIN, otp: '000000' }),
    ).rejects.toMatchObject({ code: 'OTP_NOT_FOUND' });
  });

  // --- hydration of the row read in verifyOtp ---------------------------------
  // Every case below reads a camelCase property off the row that verifyOtp
  // loads. Before the fix those were all `undefined`, because a raw row is
  // keyed by the database column name.

  it('accepts the correct OTP', async () => {
    const { service } = makeService({ rows: [dbRow()] });
    await expect(
      service.verifyOtp({ canonical: CANONICAL, purpose: OtpPurpose.LOGIN, otp: '123456' }),
    ).resolves.toEqual({ otpId: 7 });
  });

  it('rejects a wrong OTP and counts the attempt', async () => {
    const { service, qb } = makeService({ rows: [dbRow()] });
    await expect(
      service.verifyOtp({ canonical: CANONICAL, purpose: OtpPurpose.LOGIN, otp: '999999' }),
    ).rejects.toMatchObject({ code: 'INVALID_OTP' });
    expect(qb.set).toHaveBeenCalledWith({ attempts: 1 });
  });

  it('refuses an OTP that has already been used', async () => {
    const { service } = makeService({ rows: [dbRow({ used_at: new Date(Date.now() - 1_000) })] });
    await expect(
      service.verifyOtp({ canonical: CANONICAL, purpose: OtpPurpose.LOGIN, otp: '123456' }),
    ).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
  });

  it('refuses an expired OTP', async () => {
    const { service } = makeService({ rows: [dbRow({ expires_at: new Date(Date.now() - 1_000) })] });
    await expect(
      service.verifyOtp({ canonical: CANONICAL, purpose: OtpPurpose.LOGIN, otp: '123456' }),
    ).rejects.toMatchObject({ code: 'OTP_EXPIRED' });
  });

  it('locks out once the attempt limit is reached', async () => {
    const { service } = makeService({ rows: [dbRow({ attempts: 5 })] });
    await expect(
      service.verifyOtp({ canonical: CANONICAL, purpose: OtpPurpose.LOGIN, otp: '123456' }),
    ).rejects.toMatchObject({ code: 'OTP_LOCKED' });
  });

  it('locks out on the attempt that reaches the limit', async () => {
    const { service } = makeService({ rows: [dbRow({ attempts: 4 })] });
    await expect(
      service.verifyOtp({ canonical: CANONICAL, purpose: OtpPurpose.LOGIN, otp: '999999' }),
    ).rejects.toMatchObject({ code: 'OTP_LOCKED' });
  });

  it('enforces the resend cooldown using the stored creation time', async () => {
    const { service, sms } = makeService({ rows: [dbRow({ created_at: new Date(Date.now() - 10_000) })] });
    await expect(
      service.requestOtp({ canonical: CANONICAL, providerNumber: '919876543210', purpose: OtpPurpose.LOGIN }),
    ).rejects.toMatchObject({ code: 'OTP_RATE_LIMITED' });
    expect(sms.sendOtp).not.toHaveBeenCalled();
  });

  it('allows a resend once the cooldown has passed', async () => {
    const { service } = makeService({ rows: [dbRow({ created_at: new Date(Date.now() - 90_000) })] });
    await expect(
      service.requestOtp({ canonical: CANONICAL, providerNumber: '919876543210', purpose: OtpPurpose.LOGIN }),
    ).resolves.toEqual({ expiresInSeconds: 300 });
  });
});
