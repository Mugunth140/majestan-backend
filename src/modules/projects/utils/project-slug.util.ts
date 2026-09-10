export function toProjectSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Builds the canonical URL slug for a project.
 *
 * Format: `{slug}-{projectCode-lowercase}`
 * Example: prestige-park-grove-pra0042
 *
 * This produces a flat, root-level URL (domain.com/{slug})
 * that is unique by construction (project codes are unique).
 * Falls back to just `{slug}` when no projectCode is available.
 *
 * @deprecated The old `projects/{city}/{slug}` format was replaced by
 * ProjectRootCustomSlug1781800000000 (canonical_slug = slug) and then by
 * AddProjectCodeToCanonicalSlug1781900000000 (this new format).
 * AdminProjectsService.create/update now builds canonicalSlug inline.
 */
export function buildProjectCanonical(slug: string, projectCode?: string | null): string {
  if (projectCode) {
    return `${slug}-${projectCode.toLowerCase()}`;
  }
  return slug;
}
