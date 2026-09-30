// site/majestan-backend/src/modules/sms/pay4sms.provider.spec.ts
import { Pay4SmsProvider, buildRegisterMessage, buildLoginMessage, parseSendResponse } from './pay4sms.provider';

describe('parseSendResponse', () => {
  it('accepts the real Pay4SMS JSON tuple response', () => {
    // Captured live from pay4sms.in on 2026-09-30.
    expect(parseSendResponse('[["6384761234","310955552_0","Sent",1]]')).toEqual({
      accepted: true,
      messageId: '310955552_0',
    });
  });

  it('accepts a multi-recipient response using the first message id', () => {
    expect(
      parseSendResponse('[["6384761234","A_1","Sent",1],["6384761235","B_2","Sent",1]]'),
    ).toEqual({ accepted: true, messageId: 'A_1' });
  });

  it('rejects the textual insufficient-credits response with its code', () => {
    expect(parseSendResponse('184 : Insufficient Credits')).toEqual({
      accepted: false,
      providerCode: '184',
    });
  });

  it('rejects a zero-padded textual code', () => {
    expect(parseSendResponse('021 : Invalid Credit Type')).toEqual({
      accepted: false,
      providerCode: '21',
    });
  });

  it('still accepts a msgid= text response', () => {
    expect(parseSendResponse('msgid=ABC123')).toEqual({ accepted: true, messageId: 'ABC123' });
  });

  it('reports an unparseable body with no provider code', () => {
    expect(parseSendResponse('<html>gateway timeout</html>')).toEqual({
      accepted: false,
      providerCode: null,
    });
  });
});

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

  it('treats a live-shaped accepted response as success, not failure', async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => '[["6384761234","310955552_0","Sent",1]]',
    }) as never;
    const provider = makeProvider(fakeFetch);
    await expect(
      provider.sendOtp({ providerNumber: '919876543210', purpose: 'LOGIN' as never, otp: '071824' }),
    ).resolves.toEqual({ messageId: '310955552_0' });
  });

  it('maps the textual insufficient-credits response to a classified error', async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      text: async () => '184 : Insufficient Credits',
    }) as never;
    const provider = makeProvider(fakeFetch);
    await expect(
      provider.sendOtp({ providerNumber: '919876543210', purpose: 'LOGIN' as never, otp: '071824' }),
    ).rejects.toMatchObject({ code: 'OTP_SEND_FAILED', providerCode: '184' });
  });

  it('times out after 30s as temporary error', async () => {
    jest.useFakeTimers();
    try {
      const fakeFetch = async (_url: string, init: RequestInit) => {
        await new Promise((_, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        });
        throw new Error('unreachable');
      };
      const provider = makeProvider(fakeFetch);
      const pending = provider.sendOtp({ providerNumber: '919876543210', purpose: 'LOGIN' as never, otp: '071824' });
      // Attach the handler before advancing: otherwise the rejection fires with
      // no handler attached while the timers drain, and jest reports it as an
      // unhandled rejection instead of routing it to the assertion.
      const assertion = expect(pending).rejects.toMatchObject({ code: 'OTP_PROVIDER_TEMPORARY_ERROR' });
      await jest.advanceTimersByTimeAsync(30_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });

  it('accepts a slow provider response instead of aborting at the old 10s limit', async () => {
    // Production case from 2026-09-30: the gateway took over ten seconds to
    // answer. The client aborted at 10s and reported a temporary error, but
    // the SMS was delivered anyway — with no OTP row persisted, so the code
    // the user received could never be verified.
    jest.useFakeTimers();
    try {
      const fakeFetch = (_url: string, init: RequestInit) =>
        new Promise((resolve, reject) => {
          const delivered = setTimeout(
            () => resolve({ ok: true, status: 200, text: async () => 'msgid=SLOW123' }),
            20_000,
          );
          init.signal?.addEventListener('abort', () => {
            clearTimeout(delivered);
            reject(new Error('aborted'));
          });
        });
      const provider = makeProvider(fakeFetch);
      const pending = provider.sendOtp({ providerNumber: '919876543210', purpose: 'LOGIN' as never, otp: '071824' });
      // Handler first, for the same unhandled-rejection reason as above.
      const assertion = expect(pending).resolves.toEqual({ messageId: 'SLOW123' });
      await jest.advanceTimersByTimeAsync(20_000);
      await assertion;
    } finally {
      jest.useRealTimers();
    }
  });
});
