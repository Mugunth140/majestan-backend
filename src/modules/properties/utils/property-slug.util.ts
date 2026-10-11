export const normalizeSeoSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-')
    .replace(/\/+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

export const extractPropertyCodeFromSeoSlug = (slug: string): string | null => {
  const normalized = normalizeSeoSlug(slug);
  if (!normalized) {
    return null;
  }

  const tokenMatch = normalized.match(/-([a-z]{1,6}\d+)$/i);
  if (tokenMatch?.[1]) {
    return tokenMatch[1].toLowerCase();
  }

  const finalToken = normalized.split('-').at(-1) ?? '';
  if (/^[a-z0-9]{2,64}$/i.test(finalToken)) {
    return finalToken.toLowerCase();
  }

  return null;
};

export const getPropertyTypeCode = (propertyType: string): string => {
  switch (propertyType.toLowerCase()) {
    case 'apartment':
      return 'ap';
    case 'villa':
      return 'v';
    case 'plot':
      return 'p';
    case 'commercial':
    case 'commercial-space':
      return 'cs';
    case 'coworking':
      return 'cw';
    case 'farmland':
      return 'fl';
    case 'industrial':
    case 'industrial-space':
      return 'is';
    case 'independent-house':
    case 'individual_portion':
      return 'ip';
    default:
      return 'ot';
  }
};

export const generateSeoSlug = (title: string, propertyType: string, id: number): string => {
  const normalizedTitle = normalizeSeoSlug(title);
  const code = getPropertyTypeCode(propertyType);
  const paddedId = String(id).padStart(3, '0');
  return `${normalizedTitle}-${code}${paddedId}`;
};

export const stripPropertyIdSuffix = (slug: string): string => {
  const normalized = normalizeSeoSlug(slug);
  return normalized.replace(/-[a-z]{1,6}\d+$/i, '');
};

/**
 * URL slug suffix (`-ap006`) → DB property type + id. Only the two-letter
 * codes the slug generator emits are accepted — anything else (project
 * codes like `pa`, legacy tokens) returns null so callers 404 instead of
 * serving an unrelated property that happens to share the numeric id.
 */
const SLUG_SUFFIX_TYPES: Record<string, string> = {
  ap: 'apartment',
  cs: 'commercial',
  ip: 'individual_portion',
  fl: 'farmland',
  cw: 'coworking',
  is: 'industrial',
  ot: 'other',
};

export const parsePropertySlugSuffix = (
  slug: string,
): { propertyType: string; id: number } | null => {
  const match = slug.match(/-([a-z]{2})(\d+)$/i);
  if (!match) return null;
  const propertyType = SLUG_SUFFIX_TYPES[match[1].toLowerCase()];
  if (!propertyType) return null;
  const id = parseInt(match[2], 10);
  if (!Number.isFinite(id)) return null;
  return { propertyType, id };
};

export const enforceSlugSuffix = (slug: string, propertyType: string, id: number): string => {
  const stripped = stripPropertyIdSuffix(slug);
  const code = getPropertyTypeCode(propertyType);
  const paddedId = String(id).padStart(3, '0');
  return `${stripped}-${code}${paddedId}`;
};
