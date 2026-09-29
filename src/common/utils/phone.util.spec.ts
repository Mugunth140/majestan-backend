// site/majestan-backend/src/common/utils/phone.util.spec.ts
import { normalizePhone, maskPhone } from './phone.util';

describe('normalizePhone', () => {
  it('keeps +91 canonical and strips + for provider', () => {
    expect(normalizePhone('+91', '9876543210')).toEqual({
      canonical: '+919876543210',
      providerNumber: '919876543210',
    });
  });

  it('prefixes bare Indian 10-digit with 91 for provider only', () => {
    expect(normalizePhone('+91', ' 98765 43210 ')).toEqual({
      canonical: '+919876543210',
      providerNumber: '919876543210',
    });
  });

  it('never double-adds 91 and rejects bad input', () => {
    expect(normalizePhone('+91', '919876543210').providerNumber).toBe('919876543210');
    expect(() => normalizePhone('+91', '12345')).toThrow();
    expect(() => normalizePhone('91', '9876543210')).toThrow();
  });

  it('supports non-IN country codes without forcing 91', () => {
    expect(normalizePhone('+1', '4155552671')).toEqual({
      canonical: '+14155552671',
      providerNumber: '14155552671',
    });
  });
});

describe('maskPhone', () => {
  it('masks middle digits and never returns full number', () => {
    const masked = maskPhone('+919876543210');
    expect(masked).toContain('****');
    expect(masked).not.toContain('9876543210');
  });
});
