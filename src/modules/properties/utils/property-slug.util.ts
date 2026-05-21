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
