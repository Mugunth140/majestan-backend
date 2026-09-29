// site/majestan-backend/src/common/utils/phone.util.ts
const COUNTRY_CODE_RE = /^\+[1-9]\d{0,4}$/;

export const normalizePhone = (
  countryCode: string,
  phone: string,
): { canonical: string; providerNumber: string } => {
  const cc = countryCode.trim();
  if (!COUNTRY_CODE_RE.test(cc)) {
    throw new Error('Invalid country code');
  }
  let digits = phone.replace(/\D/g, '');
  const ccDigits = cc.slice(1);
  if (digits.startsWith(ccDigits)) {
    digits = digits.slice(ccDigits.length);
  }
  if (cc === '+91') {
    if (/^0[6-9]\d{9}$/.test(digits)) digits = digits.slice(1);
    if (!/^[6-9]\d{9}$/.test(digits)) throw new Error('Invalid phone number');
    return { canonical: `+91${digits}`, providerNumber: `91${digits}` };
  }
  if (!/^\d{5,15}$/.test(digits)) throw new Error('Invalid phone number');
  return { canonical: `${cc}${digits}`, providerNumber: `${ccDigits}${digits}` };
};

export const maskPhone = (canonical: string): string => {
  const digits = canonical.replace(/\D/g, '');
  if (digits.length <= 7) return '*******';
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
};
