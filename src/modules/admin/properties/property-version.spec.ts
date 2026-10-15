import { isSameVersion } from './property-version';

describe('isSameVersion', () => {
  it('matches the version the editor loaded, to the millisecond', () => {
    expect(isSameVersion(new Date('2026-10-01T07:06:47.000Z'), '2026-10-01T07:06:47.000Z')).toBe(true);
  });

  it('rejects a version saved by someone else since', () => {
    expect(isSameVersion(new Date('2026-10-15T10:00:00.123Z'), '2026-10-01T07:06:47.000Z')).toBe(false);
    expect(isSameVersion(new Date('2026-10-01T07:06:47.001Z'), '2026-10-01T07:06:47.000Z')).toBe(false);
  });

  it('rejects unreadable versions instead of letting the save through', () => {
    expect(isSameVersion(null, '2026-10-01T07:06:47.000Z')).toBe(false);
    expect(isSameVersion(new Date(), 'not-a-date')).toBe(false);
  });
});
