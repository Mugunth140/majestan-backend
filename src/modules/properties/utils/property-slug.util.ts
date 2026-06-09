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
  return `${normalizedTitle}-${code}${id}`;
};
