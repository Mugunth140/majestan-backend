// site/majestan-backend/src/modules/sms/pay4sms.errors.spec.ts
import { classifyPay4SmsCode } from './pay4sms.errors';

describe('classifyPay4SmsCode', () => {
  it('flags DLT config codes as non-retryable', () => {
    for (const code of ['421', '426', '429', '433', '623', '630', '637']) {
      expect(classifyPay4SmsCode(code)).toBe('OTP_DLT_CONFIGURATION_ERROR');
    }
  });

  it('flags destination codes', () => {
    expect(classifyPay4SmsCode('55')).toBe('OTP_DESTINATION_INVALID');
  });

  it('flags rate-limit codes', () => {
    expect(classifyPay4SmsCode('4')).toBe('OTP_RATE_LIMITED');
  });

  it('flags transient codes', () => {
    expect(classifyPay4SmsCode('40')).toBe('OTP_PROVIDER_TEMPORARY_ERROR');
  });
});
