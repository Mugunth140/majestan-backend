// Same character rules as project slugs: "&" becomes "and", apostrophes are
// dropped, and anything else outside [a-z0-9] becomes a hyphen. "P&K" and
// "Daksha's" otherwise reached URLs, sitemaps and canonicals verbatim.
export const normalizeSeoSlug = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/['’‘`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

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

/** Words too common in listing slugs to say two slugs describe the same home. */
const SLUG_STOPWORDS = new Set([
  'a', 'an', 'and', 'at', 'for', 'in', 'near', 'of', 'on', 'the', 'to',
  'sale', 'sell', 'rent', 'lease', 'coimbatore',
]);

const slugWords = (slug: string): Set<string> => {
  let base = normalizeSeoSlug(slug);
  // Strip every trailing id code: crawlers also hit doubled ones (-ap2462-ap2462).
  while (/-[a-z]{1,6}\d+$/i.test(base)) base = stripPropertyIdSuffix(base);
  return new Set(
    base.split('-').filter((w) => w && !SLUG_STOPWORDS.has(w) && !/^\d+$/.test(w)),
  );
};

/**
 * Whether a requested slug plausibly names this property, judged by the words
 * before its id code. Guards the id-suffix recovery: the old website's URLs
 * end in codes like -ap178 that collide with unrelated new ids, so
 * "1-bhk-…-town-icon-city-…-ap178" must not open "chettinad-burgandy-…-ap178".
 * A renamed listing still matches when at least half its current words appear.
 */
export const slugDescribesProperty = (requested: string, propertySlug: string): boolean => {
  const wanted = slugWords(requested);
  const actual = slugWords(propertySlug);
  if (actual.size === 0) return wanted.size === 0;
  let shared = 0;
  for (const w of actual) if (wanted.has(w)) shared += 1;
  return shared / actual.size >= 0.5;
};
