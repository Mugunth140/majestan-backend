// site/majestan-backend/src/modules/sms/sms.service.ts
import { Injectable } from '@nestjs/common';
import { OtpPurpose } from '../auth/otp-purpose.enum';
import { Pay4SmsProvider } from './pay4sms.provider';

export type SendOtpArgs = {
  providerNumber: string;
  purpose: OtpPurpose;
  otp: string;
};

@Injectable()
export class SmsService {
  constructor(private readonly pay4sms: Pay4SmsProvider) {}

  sendOtp(args: SendOtpArgs): Promise<{ messageId: string }> {
    return this.pay4sms.sendOtp(args);
  }
}
