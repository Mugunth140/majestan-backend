// site/majestan-backend/src/config/sms.config.spec.ts
import smsConfig from './sms.config';

describe('smsConfig', () => {
  const OLD = { ...process.env };
  afterEach(() => { process.env = { ...OLD }; });

  it('reads Pay4SMS settings with safe defaults for IDs', () => {
    process.env.PAY4SMS_API_URL = 'http://pay4sms.in/sendsms/';
    process.env.PAY4SMS_TOKEN = 'env-token';
    process.env.PAY4SMS_SENDER_ID = 'PRSMRK';
    process.env.PAY4SMS_REGISTER_TEMPLATE_ID = '1777179023885095379';
    process.env.PAY4SMS_LOGIN_TEMPLATE_ID = '1777179016683380342';
    const cfg = smsConfig();
    expect(cfg.pay4sms.apiUrl).toBe('http://pay4sms.in/sendsms/');
    expect(cfg.pay4sms.token).toBe('env-token');
    expect(cfg.pay4sms.senderId).toBe('PRSMRK');
    expect(cfg.pay4sms.registerTemplateId).toBe('1777179023885095379');
    expect(cfg.pay4sms.loginTemplateId).toBe('1777179016683380342');
  });

  it('defaults to expected sender and template IDs when env is empty', () => {
    delete process.env.PAY4SMS_SENDER_ID;
    delete process.env.PAY4SMS_REGISTER_TEMPLATE_ID;
    delete process.env.PAY4SMS_LOGIN_TEMPLATE_ID;
    const cfg = smsConfig();
    expect(cfg.pay4sms.senderId).toBe('PRSMRK');
    expect(cfg.pay4sms.registerTemplateId).toBe('1777179023885095379');
    expect(cfg.pay4sms.loginTemplateId).toBe('1777179016683380342');
  });

  it('reads the credit type from env', () => {
    process.env.PAY4SMS_CREDIT = '2';
    expect(smsConfig().pay4sms.credit).toBe('2');

    process.env.PAY4SMS_CREDIT = '4';
    expect(smsConfig().pay4sms.credit).toBe('4');
  });

  it('defaults to the transactional credit type (2) and rejects nonsense', () => {
    delete process.env.PAY4SMS_CREDIT;
    expect(smsConfig().pay4sms.credit).toBe('2');

    process.env.PAY4SMS_CREDIT = 'four';
    expect(smsConfig().pay4sms.credit).toBe('2');
  });
});
