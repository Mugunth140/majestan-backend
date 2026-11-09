import { randomUUID } from 'node:crypto';
import {
  analyticsPath,
  validateBatch,
  visitorId,
  deviceInfo,
} from './analytics-event';

export const event = (extra: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  sessionId: randomUUID(),
  pageId: randomUUID(),
  kind: 'pageview',
  name: 'pageview',
  timestamp: Date.now(),
  path: '/apartments-for-sale-in-coimbatore',
  hostname: 'www.majestanrealty.com',
  ...extra,
});
describe('site analytics boundary', () => {
  it('strips queries and referrer paths; drops sensitive campaign labels', () => {
    const [e] = validateBatch({
      version: 1,
      events: [
        event({
          path: '/projects?email=private@example.com',
          referrer: 'https://google.com/search?q=private',
          utmSource: 'google',
          utmCampaign: 'private@example.com',
        }),
      ],
    });
    expect(e.path).toBe('/projects');
    expect(e.referrer).toBe('google.com');
    expect(e.utmCampaign).toBeUndefined();
  });
  it.each([
    '/admin',
    '/login',
    '/api/test',
    '//elsewhere.com',
    '/private%40example.com',
    '/9876543210',
    '/foo%3Ftoken',
  ])('excludes private path %s', (path) =>
    expect(analyticsPath(path)).toBeNull(),
  );
  it('bounds batch size, age, numeric metrics and disallows arbitrary payload fields', () => {
    for (const events of [
      Array.from({ length: 21 }, () => event()),
      [event({ timestamp: Date.now() - 86400_001 })],
      [event({ durationMs: Infinity })],
      [event({ phone: '9876543210' })],
      [event({ kind: 'conversion', name: 'anything' })],
      [event({ hostname: 'evil.com' })],
    ]) {
      expect(() => validateBatch({ version: 1, events })).toThrow(
        'Invalid analytics batch',
      );
    }
  });
  it('validates web vitals and accepts INP', () => {
    expect(
      validateBatch({
        version: 1,
        events: [
          event({
            kind: 'web_vital',
            name: 'INP',
            value: 240,
            rating: 'needs-improvement',
            metricId: 'v4-1793907576088-3493847832156',
          }),
        ],
      }),
    ).toHaveLength(1);
    expect(() =>
      validateBatch({
        version: 1,
        events: [event({ kind: 'web_vital', name: 'INP' })],
      }),
    ).toThrow();
  });
  it('rotates visitor pseudonyms daily, retaining no reversible address', () => {
    const a = visitorId('secret', '192.0.2.1', 'UA', new Date('2026-11-06'));
    expect(a).toMatch(/^[a-f0-9]{64}$/);
    expect(a).toBe(
      visitorId('secret', '192.0.2.1', 'UA', new Date('2026-11-06')),
    );
    expect(a).not.toBe(
      visitorId('secret', '192.0.2.1', 'UA', new Date('2026-11-07')),
    );
  });
  it('classifies device without persisting user agent', () => {
    expect(deviceInfo('Mozilla Android Mobile Chrome/123 Safari/537')).toEqual({
      browser: 'Chrome',
      os: 'Android',
      device: 'mobile',
    });
  });
});
