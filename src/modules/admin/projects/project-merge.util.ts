/**
 * Field-level optimistic concurrency for project edits.
 *
 * Every save records, per field, the revision that last changed it
 * (`fieldRevisions`), with units tracked one by one as `unit:<code>`. A save
 * made from an older revision is then only refused when someone else changed
 * one of the SAME fields or units since; edits to different fields — or to
 * different units — merge instead of blocking each other.
 */

/** Request keys that steer the merge and are never written as columns. */
export const MERGE_META_KEYS = ['expectedRevision', 'changedFields', 'changedUnitCodes'] as const;

export type FieldRevisions = Record<string, number>;

export const unitKey = (code: string) => `unit:${code}`;

/**
 * The fields and units this save would overwrite that changed after `base`.
 * `changedUnitCodes` undefined means the client sent the whole unit list
 * without saying which units it touched, so units conflict as one field.
 */
export function findConflicts(
  revisions: FieldRevisions | null | undefined,
  base: number,
  changedFields: string[],
  changedUnitCodes: string[] | undefined,
): string[] {
  const seen = revisions ?? {};
  const after = (key: string) => (seen[key] ?? 0) > base;
  const conflicts = changedFields.filter((field) => field !== 'units' && after(field));
  if (changedFields.includes('units')) {
    if (changedUnitCodes) conflicts.push(...changedUnitCodes.filter((code) => after(unitKey(code))).map(unitKey));
    else if (after('units') || Object.keys(seen).some((key) => key.startsWith('unit:') && after(key))) conflicts.push('units');
  }
  return conflicts;
}

/** Stamps every field and unit this save wrote with the revision it creates. */
export function nextFieldRevisions(
  revisions: FieldRevisions | null | undefined,
  revision: number,
  changedFields: string[],
  unitCodes: string[],
): FieldRevisions {
  const next: FieldRevisions = { ...(revisions ?? {}) };
  for (const field of changedFields) next[field] = revision;
  for (const code of unitCodes) next[unitKey(code)] = revision;
  return next;
}

const LABELS: Record<string, string> = {
  units: 'the units',
  amenities: 'amenities',
  faqs: 'FAQs',
  galleryImageUrls: 'the gallery',
  reraNumber: 'RERA number',
  projectAreaSqft: 'project area',
};

function label(key: string): string {
  if (key.startsWith('unit:')) return `unit ${key.slice(5)}`;
  return LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').toLowerCase();
}

export function conflictMessage(conflicts: string[]): string {
  const names = conflicts.slice(0, 4).map(label);
  const more = conflicts.length > 4 ? ` and ${conflicts.length - 4} more` : '';
  return `Someone else changed ${names.join(', ')}${more} since you opened this project. Nothing was saved — load the latest version.`;
}
