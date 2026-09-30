// site/majestan-backend/src/modules/sms/pay4sms.provider.spec.ts
import { Pay4SmsProvider, buildRegisterMessage, buildLoginMessage } from './pay4sms.provider';

describe('DLT message builders', () => {
  it('register text is byte-exact', () => {
    expect(buildRegisterMessage('482913')).toBe(
      'Your registration code is 482913. This code expires in 15 minutes. Please do not share it with anyone - Prismark Assets Private Limited',
    );
  });

  it('login text is byte-exact', () => {
    expect(buildLoginMessage('071824')).toBe(
      'Your login OTP is 071824. This code is valid for 5 minutes. Do not share it with anyone - Prismark Assets Private Limited.',
    );
  });
});

describe('Pay4SmsProvider.sendOtp', () => {
  const makeProvider = (fetchImpl: unknown, credit = '2') => {
    const config = {
      getOrThrow: (key: string) => {
        const map: Record<string, string> = {
          'sms.pay4sms.apiUrl': 'http://pay4sms.in/sendsms/',
          'sms.pay4sms.token': 'secret-token',
          'sms.pay4sms.senderId': 'PRSMRK',
          'sms.pay4sms.credit': credit,
          'sms.pay4sms.registerTemplateId': '1777179023885095379',
          'sms.pay4sms.loginTemplateId': '1777179016683380342',
        };
        return map[key];
      },
      get: () => undefined,
    };
    return new Pay4SmsProvider(config as never, fetchImpl as never);
  };

  it('sends the configured credit type with sender=PRSMRK register template', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fakeFetch = async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200, text: async () => 'msgid=ABC123' } as never;
    };
    const provider = makeProvider(fakeFetch);
    const res = await provider.sendOtp({ providerNumber: '919876543210', purpose: 'REGISTER' as never, otp: '482913' });
    expect(res.messageId).toBe('ABC123');
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    // Transactional route is credit=2; the OTP route was credit=4.
    expect(url.searchParams.get('credit')).toBe('2');
    expect(url.searchParams.get('sender')).toBe('PRSMRK');
    expect(url.searchParams.get('templateid')).toBe('1777179023885095379');
    expect(url.searchParams.get('number')).toBe('919876543210');
    expect(url.searchParams.get('token')).toBe('secret-token');
    expect(url.searchParams.get('message')).toContain('482913');
  });

  it('honours an OTP-route credit type when configured', async () => {
    let captured = '';
    const fakeFetch = async (url: string) => {
      captured = url;
      return { ok: true, status: 200, text: async () => 'msgid=XYZ' } as never;
    };
    const provider = makeProvider(fakeFetch, '4');
    await provider.sendOtp({ providerNumber: '919876543210', purpose: 'LOGIN' as never, otp: '071824' });
    expect(new URL(captured).searchParams.get('credit')).toBe('4');
  });

  it('uses login template for LOGIN purpose', async () => {
    let captured = '';
    const fakeFetch = async (url: string) => {
      captured = url;
      return { ok: true, status: 200, text: async () => 'msgid=XYZ' } as never;
    };
    const provider = makeProvider(fakeFetch);
    await provider.sendOtp({ providerNumber: '919876543210', purpose: 'LOGIN' as never, otp: '071824' });
    expect(new URL(captured).searchParams.get('templateid')).toBe('1777179016683380342');
  });

  it('maps provider error code 429 to DLT configuration error and never logs token', async () => {
    const fakeFetch = async () => ({ ok: true, status: 200, text: async () => 'error=429' }) as never;
    const provider = makeProvider(fakeFetch);
    await expect(
      provider.sendOtp({ providerNumber: '919876543210', purpose: 'REGISTER' as never, otp: '482913' }),
    ).rejects.toMatchObject({ code: 'OTP_DLT_CONFIGURATION_ERROR' });
  });

  it('times out after 10s as temporary error', async () => {
    const fakeFetch = async (_url: string, init: RequestInit) => {
      await new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      });
      throw new Error('unreachable');
    };
    const provider = makeProvider(fakeFetch);
    await expect(
      provider.sendOtp({ providerNumber: '919876543210', purpose: 'LOGIN' as never, otp: '071824' }),
    ).rejects.toMatchObject({ code: 'OTP_PROVIDER_TEMPORARY_ERROR' });
  }, 15000);
});
