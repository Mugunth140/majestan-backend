// site/majestan-backend/src/common/utils/otp-generator.util.spec.ts
import { generateOtp } from './otp-generator.util';
import crypto from 'node:crypto';

describe('generateOtp', () => {
  it('is exactly 6 numeric digits', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateOtp()).toMatch(/^[0-9]{6}$/);
    }
  });

  it('uses crypto.randomInt, never Math.random', () => {
    const spy = jest.spyOn(crypto, 'randomInt');
    const mathSpy = jest.spyOn(Math, 'random');
    generateOtp();
    expect(spy).toHaveBeenCalled();
    expect(mathSpy).not.toHaveBeenCalled();
    spy.mockRestore();
    mathSpy.mockRestore();
  });

  it('preserves leading zeroes as string', () => {
    const spy = jest.spyOn(crypto, 'randomInt').mockReturnValue(91824 as never);
    expect(generateOtp()).toBe('091824');
    spy.mockRestore();
  });
});
