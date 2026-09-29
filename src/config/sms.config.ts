import { registerAs } from '@nestjs/config';

export default registerAs('sms', () => ({
  pay4sms: {
    apiUrl: process.env.PAY4SMS_API_URL ?? 'http://pay4sms.in/sendsms/',
    token: process.env.PAY4SMS_TOKEN ?? '',
    senderId: process.env.PAY4SMS_SENDER_ID ?? 'PRSMRK',
    registerTemplateId:
      process.env.PAY4SMS_REGISTER_TEMPLATE_ID ?? '1777179023885095379',
    loginTemplateId:
      process.env.PAY4SMS_LOGIN_TEMPLATE_ID ?? '1777179016683380342',
  },
}));
