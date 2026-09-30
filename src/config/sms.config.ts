import { registerAs } from '@nestjs/config';

// Pay4SMS credit type selects the billing route. '2' is the transactional
// route; '4' is the dedicated OTP route. Pay4SMS told us to bill OTPs as
// transactional, so that is the default — but the value is env-driven because
// the vendor has changed this once already and may again.
const parseCreditType = (raw: string | undefined): string => {
  const value = (raw ?? '').trim();
  return value === '4' ? '4' : '2';
};

export default registerAs('sms', () => ({
  pay4sms: {
    apiUrl: process.env.PAY4SMS_API_URL ?? 'http://pay4sms.in/sendsms/',
    token: process.env.PAY4SMS_TOKEN ?? '',
    senderId: process.env.PAY4SMS_SENDER_ID ?? 'PRSMRK',
    credit: parseCreditType(process.env.PAY4SMS_CREDIT),
    registerTemplateId:
      process.env.PAY4SMS_REGISTER_TEMPLATE_ID ?? '1777179023885095379',
    loginTemplateId:
      process.env.PAY4SMS_LOGIN_TEMPLATE_ID ?? '1777179016683380342',
  },
}));
