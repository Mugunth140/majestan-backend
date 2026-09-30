// site/majestan-backend/src/modules/sms/pay4sms.provider.ts
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '../auth/otp-purpose.enum';
import { maskPhone } from '../../common/utils/phone.util';
import { OtpSendError, classifyPay4SmsCode } from './pay4sms.errors';

export const REGISTER_MESSAGE_PREFIX = 'Your registration code is ';
export const buildRegisterMessage = (otp: string): string =>
  `Your registration code is ${otp}. This code expires in 15 minutes. Please do not share it with anyone - Prismark Assets Private Limited`;

export const buildLoginMessage = (otp: string): string =>
  `Your login OTP is ${otp}. This code is valid for 5 minutes. Do not share it with anyone - Prismark Assets Private Limited.`;

type FetchLike = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

export const PAY4SMS_TIMEOUT_MS = 10_000;

@Injectable()
export class Pay4SmsProvider {
  private readonly logger = new Logger(Pay4SmsProvider.name);

  constructor(
    private readonly configService: ConfigService,
    @Optional() @Inject('PAY4SMS_FETCH')
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
  ) {}

  async sendOtp(args: { providerNumber: string; purpose: OtpPurpose; otp: string }): Promise<{ messageId: string }> {
    const apiUrl = this.configService.getOrThrow<string>('sms.pay4sms.apiUrl');
    const token = this.configService.getOrThrow<string>('sms.pay4sms.token');
    const sender = this.configService.getOrThrow<string>('sms.pay4sms.senderId');
    const credit = this.configService.getOrThrow<string>('sms.pay4sms.credit');
    const registerTemplateId = this.configService.getOrThrow<string>('sms.pay4sms.registerTemplateId');
    const loginTemplateId = this.configService.getOrThrow<string>('sms.pay4sms.loginTemplateId');

    if (!token) {
      throw new OtpSendError('OTP_SEND_FAILED', null, 'Pay4SMS token is not configured');
    }

    const message = args.purpose === OtpPurpose.REGISTER ? buildRegisterMessage(args.otp) : buildLoginMessage(args.otp);
    const templateid = args.purpose === OtpPurpose.REGISTER ? registerTemplateId : loginTemplateId;
    const params = new URLSearchParams({
      token,
      credit,
      sender,
      message,
      number: args.providerNumber,
      templateid,
    });
    const url = `${apiUrl}?${params.toString()}`;
    const masked = maskPhone(args.providerNumber);
    this.logger.log(`SMS OTP request provider=pay4sms purpose=${args.purpose} phone=${masked}`);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PAY4SMS_TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(url, { method: 'GET', signal: controller.signal });
      const body = await res.text();
      const msgMatch = body.match(/msgid\s*[:=]\s*([A-Za-z0-9_-]+)/i);
      if (res.ok && msgMatch) {
        return { messageId: msgMatch[1] };
      }
      const errMatch = body.match(/(?:error|err|code)\s*[:=]\s*(\d{1,4})/i) ?? body.match(/\b(\d{2,3})\b/);
      const providerCode = errMatch ? errMatch[1] : null;
      const code = providerCode ? classifyPay4SmsCode(providerCode) : 'OTP_SEND_FAILED';
      this.logger.warn(`SMS OTP provider failure provider=pay4sms purpose=${args.purpose} errorCode=${providerCode ?? 'unknown'} phone=${masked}`);
      throw new OtpSendError(code, providerCode, `Pay4SMS rejected OTP send (${providerCode ?? 'unknown'})`);
    } catch (error) {
      if (error instanceof OtpSendError) throw error;
      const aborted = error instanceof Error && (error.name === 'AbortError' || error.message.includes('abort'));
      this.logger.warn(`SMS OTP provider failure provider=pay4sms purpose=${args.purpose} errorCode=${aborted ? 'timeout' : 'network'} phone=${masked}`);
      throw new OtpSendError('OTP_PROVIDER_TEMPORARY_ERROR', null, 'Pay4SMS request timed out or failed');
    } finally {
      clearTimeout(timer);
    }
  }
}
