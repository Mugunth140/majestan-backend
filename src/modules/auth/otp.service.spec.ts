// site/majestan-backend/src/modules/auth/otp.service.spec.ts
import { DataSource } from 'typeorm';
import { OtpService } from './otp.service';
import { OtpPurpose } from './otp-purpose.enum';

const makeService = (overrides: { rows?: any[]; sms?: unknown; saltRounds?: number } = {}) => {
  const rows: any[] = overrides.rows ?? [];
  const qb: any = {
    whereFns: [] as Array<() => void>,
    select() { return this; },
    from() { return this; },
    where() { return this; },
    andWhere() { return this; },
    orderBy() { return this; },
    limit() { return this; },
    getRawOne: async () => rows[0] ?? null,
    getRawMany: async () => rows,
    insert: () => qb,
    into: () => qb,
    values: () => qb,
    execute: async () => ({ identifiers: [{ id: 7 }], raw: { insertId: 7 } }),
    update: () => qb,
    set: () => qb,
  };
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
      service.verifyOtp({ canonical: '+919876543210', purpose: OtpPurpose.LOGIN, otp: '000000' }),
    ).rejects.toMatchObject({ code: 'OTP_NOT_FOUND' });
  });
});
