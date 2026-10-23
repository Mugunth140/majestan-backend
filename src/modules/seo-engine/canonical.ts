export type CanonicalType = 'self' | 'parent' | 'custom';
export function resolveCanonical(
  type: CanonicalType | undefined,
  custom: string | undefined,
  path: string,
  parent: string | undefined,
  site: string,
) {
  const clean = (value: string) => {
    const url = new URL(value, site);
    return url.pathname.replace(/\/+$/, '') || '/';
  };
  if (type === 'custom' && custom?.trim()) {
    try {
      const u = new URL(custom, site);
      if (
        ['http:', 'https:'].includes(u.protocol) &&
        !u.username &&
        !u.password
      )
        return u.href;
    } catch {}
  }
  return site + clean(type === 'parent' && parent ? parent : path);
}
