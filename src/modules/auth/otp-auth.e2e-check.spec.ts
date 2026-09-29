// site/majestan-backend/src/modules/auth/otp-auth.e2e-check.spec.ts
describe('OTP routes wiring', () => {
  it('exposes four OTP endpoints on AuthController', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AuthController } = require('./auth.controller');
    const proto = AuthController.prototype;
    for (const m of ['requestRegisterOtp', 'requestLoginOtp', 'verifyRegisterOtp', 'verifyLoginOtp']) {
      expect(typeof proto[m]).toBe('function');
    }
  });
});
