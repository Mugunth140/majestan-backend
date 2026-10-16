import { isInternalRequest } from './site-throttler.guard';

const req = (headers: Record<string, string>) => ({ headers });

describe('isInternalRequest', () => {
  const saved = process.env.INTERNAL_API_KEY;
  afterEach(() => {
    process.env.INTERNAL_API_KEY = saved;
  });

  it('accepts the configured key', () => {
    process.env.INTERNAL_API_KEY = 'k3y-value';
    expect(isInternalRequest(req({ 'x-internal-key': 'k3y-value' }))).toBe(
      true,
    );
  });

  it('rejects a wrong or missing key', () => {
    process.env.INTERNAL_API_KEY = 'k3y-value';
    expect(isInternalRequest(req({ 'x-internal-key': 'k3y-valuX' }))).toBe(
      false,
    );
    expect(isInternalRequest(req({ 'x-internal-key': 'short' }))).toBe(false);
    expect(isInternalRequest(req({}))).toBe(false);
  });

  it('is off when no key is configured, whatever the header says', () => {
    process.env.INTERNAL_API_KEY = '';
    expect(isInternalRequest(req({ 'x-internal-key': '' }))).toBe(false);
    expect(isInternalRequest(req({ 'x-internal-key': 'anything' }))).toBe(
      false,
    );
  });
});
