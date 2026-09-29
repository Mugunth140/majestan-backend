// site/majestan-backend/src/modules/sms/sms.service.spec.ts
import { SmsService } from './sms.service';
import { OtpPurpose } from '../auth/otp-purpose.enum';

describe('SmsService', () => {
  it('delegates to Pay4SmsProvider without touching OTP content', async () => {
    const sendOtp = jest.fn().mockResolvedValue({ messageId: 'M1' });
    const service = new SmsService({ sendOtp } as never);
    const res = await service.sendOtp({ providerNumber: '919876543210', purpose: OtpPurpose.LOGIN, otp: '071824' });
    expect(res).toEqual({ messageId: 'M1' });
    expect(sendOtp).toHaveBeenCalledWith({ providerNumber: '919876543210', purpose: OtpPurpose.LOGIN, otp: '071824' });
  });
});
