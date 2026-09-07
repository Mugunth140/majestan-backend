export function toProjectSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildProjectCanonical(city: string, slug: string): string {
  return `projects/${toProjectSlug(city)}/${slug}`;
}
