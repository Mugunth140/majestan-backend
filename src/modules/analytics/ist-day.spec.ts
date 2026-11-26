import { istDayOf, istDayStart } from './ist-day';

describe('India-time analytics days', () => {
  it('starts a day at 00:00 IST, 18:30 UTC the evening before', () => {
    expect(istDayStart('2026-11-26')).toBe('2026-11-25 18:30:00');
  });

  it('counts an early-morning IST event on its IST day, not the UTC one', () => {
    // 26 Nov 03:27 IST is still 25 Nov in UTC.
    expect(istDayOf(new Date('2026-11-25T21:57:07Z'))).toBe('2026-11-26');
    expect(istDayOf('2026-11-26T08:32:41Z')).toBe('2026-11-26');
    expect(istDayOf('2026-11-26T18:29:59Z')).toBe('2026-11-26');
    expect(istDayOf('2026-11-26T18:30:00Z')).toBe('2026-11-27');
  });
});
