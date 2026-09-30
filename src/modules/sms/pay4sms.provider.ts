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

// The gateway answers slowly under load — on 2026-09-30 a login send took
// over ten seconds to answer, and the old 10s abort turned a delivered SMS
// into a reported failure (with no OTP row persisted, so the delivered code
// could never be verified). Thirty seconds keeps slow successes alive without
// letting a hung gateway hold a request thread indefinitely.
export const PAY4SMS_TIMEOUT_MS = 30_000;

export type Pay4SmsSendResult =
  | { accepted: true; messageId: string }
  | { accepted: false; providerCode: string | null };

/**
 * Pay4SMS answers /sendsms/ in one of two shapes:
 *
 *   accepted: [["6384761234","310955552_0","Sent",1]]
 *   rejected: 184 : Insufficient Credits
 *
 * The accepted form is a JSON array of per-recipient tuples
 * [mobile, msgid, status, credits] — there is no "msgid=" text to grep for, so
 * a text-only parser silently reports a delivered send as a failure and the
 * OTP is never persisted. Parse the array first, then fall back to text.
 */
export function parseSendResponse(body: string): Pay4SmsSendResult {
  const trimmed = body.trim();

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const entries: unknown[] = Array.isArray(parsed) ? parsed : [parsed];

      for (const entry of entries) {
        if (!Array.isArray(entry)) continue;
        const messageId = entry[1];
        if (typeof messageId === 'string' && messageId.trim().length > 0) {
          return { accepted: true, messageId: messageId.trim() };
        }
      }
    } catch {
      // Not valid JSON after all — fall through to the text form.
    }
  }

  // Textual rejection: "184 : Insufficient Credits" / "021 : Invalid Credit Type".
  // Pay4SMS zero-pads to three digits, but classifyPay4SmsCode's sets use the
  // bare number ("4" is rate-limited), so strip the padding.
  const codeMatch = trimmed.match(/^\s*(\d{1,4})\s*[:=]/);
  if (codeMatch) {
    const bare = codeMatch[1].replace(/^0+(?=\d)/, '');
    return { accepted: false, providerCode: bare };
  }

  // Some accounts answer "msgid=..." on success.
  const msgMatch = trimmed.match(/msgid\s*[:=]\s*([A-Za-z0-9_-]+)/i);
  if (msgMatch) return { accepted: true, messageId: msgMatch[1] };

  return { accepted: false, providerCode: null };
}

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
      const parsed = parseSendResponse(body);

      if (res.ok && parsed.accepted) {
        return { messageId: parsed.messageId };
      }

      const providerCode = parsed.accepted ? null : parsed.providerCode;
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
