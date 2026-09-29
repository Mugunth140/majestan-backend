// site/majestan-backend/src/common/utils/otp-generator.util.ts
import { randomInt } from 'node:crypto';

export const generateOtp = (): string => {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
};
