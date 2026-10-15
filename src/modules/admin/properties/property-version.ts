// property-version.ts
// A property's version is its updatedAt. Editors send the version they loaded;
// a save is only allowed when it still matches (see AdminPropertiesService.update).

/** Versions are compared to the millisecond; anything unreadable never matches. */
export function isSameVersion(stored: Date | string | null | undefined, expected: string): boolean {
  const a = stored ? new Date(stored).getTime() : NaN;
  const b = new Date(expected).getTime();
  return Number.isFinite(a) && Number.isFinite(b) && a === b;
}
