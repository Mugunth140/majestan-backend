// site/majestan-backend/src/modules/sms/sms-log-safety.spec.ts
import { Pay4SmsProvider } from './pay4sms.provider';
import { OtpPurpose } from '../auth/otp-purpose.enum';

describe('SMS log safety', () => {
  it('never logs OTP, token or full phone', async () => {
    const logs: string[] = [];
    const config = {
      getOrThrow: (key: string) => {
        const map: Record<string, string> = {
          'sms.pay4sms.apiUrl': 'http://pay4sms.in/sendsms/',
          'sms.pay4sms.token': 'super-secret-token',
          'sms.pay4sms.senderId': 'PRSMRK',
          'sms.pay4sms.registerTemplateId': '1777179023885095379',
          'sms.pay4sms.loginTemplateId': '1777179016683380342',
        };
        return map[key];
      },
      get: () => undefined,
    } as never;
    const fakeFetch = async () => ({ ok: true, status: 200, text: async () => 'msgid=LOG1' }) as never;
    const provider = new Pay4SmsProvider(config, fakeFetch);
    const logSpy = jest.spyOn((provider as unknown as { logger: { log: (m: string) => void } }).logger, 'log').mockImplementation((m: string) => { logs.push(m); });
    const warnSpy = jest.spyOn((provider as unknown as { logger: { warn: (m: string) => void } }).logger, 'warn').mockImplementation((m: string) => { logs.push(m); });
    await provider.sendOtp({ providerNumber: '919876543210', purpose: OtpPurpose.LOGIN, otp: '071824' });
    const blob = logs.join('\n');
    expect(blob).not.toContain('071824');
    expect(blob).not.toContain('super-secret-token');
    expect(blob).not.toContain('919876543210');
    expect(blob).toContain('****');
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
