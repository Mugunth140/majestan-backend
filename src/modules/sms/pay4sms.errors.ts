// site/majestan-backend/src/modules/sms/pay4sms.errors.ts
export type OtpSendFailureCode =
  | 'OTP_DLT_CONFIGURATION_ERROR'
  | 'OTP_PROVIDER_TEMPORARY_ERROR'
  | 'OTP_DESTINATION_INVALID'
  | 'OTP_RATE_LIMITED'
  | 'OTP_SEND_FAILED';

const DLT_CONFIG = new Set([
  '110','111','112','113','114','116',
  '418','419','420','421','422','423','424','425','426','427','428','429','430','431','432','433','434','435','436','437','438','439','440','441','442','443','444',
  '454','455','456','457','458',
  '600','601','602','603','604','610','611','612','620','621','622','623','630','631','632','633','634','635','636','637',
]);
const DESTINATION = new Set(['5','6','9','10','55','86']);
const RATE_LIMITED = new Set(['4','53','69','74','75','88']);
const TRANSIENT = new Set(['40','71','73']);

export const classifyPay4SmsCode = (raw: string): OtpSendFailureCode => {
  const code = raw.trim();
  if (DLT_CONFIG.has(code)) return 'OTP_DLT_CONFIGURATION_ERROR';
  if (DESTINATION.has(code)) return 'OTP_DESTINATION_INVALID';
  if (RATE_LIMITED.has(code)) return 'OTP_RATE_LIMITED';
  if (TRANSIENT.has(code)) return 'OTP_PROVIDER_TEMPORARY_ERROR';
  return 'OTP_SEND_FAILED';
};

export class OtpSendError extends Error {
  constructor(
    public readonly code: OtpSendFailureCode,
    public readonly providerCode: string | null,
    message: string,
  ) {
    super(message);
    this.name = 'OtpSendError';
  }
}
