import { BadRequestException } from '@nestjs/common';

export const PROPERTY_TYPES = [
  'apartment',
  'villa',
  'individual_portion',
  'plot',
  'farmland',
  'commercial',
  'industrial',
  'coworking',
];
export const TYPE_SLUGS: Record<string, string> = {
  apartment: 'apartments',
  villa: 'villas',
  individual_portion: 'independent-houses',
  plot: 'plots',
  farmland: 'farmlands',
  commercial: 'commercial-spaces',
  industrial: 'industrial-spaces',
  coworking: 'coworking',
};
export const TYPE_LABELS: Record<string, string> = {
  apartment: 'Apartments',
  villa: 'Villas',
  individual_portion: 'Independent Houses',
  plot: 'Plots',
  farmland: 'Farmlands',
  commercial: 'Commercial Spaces',
  industrial: 'Industrial Spaces',
  coworking: 'Co-Working Spaces',
};
export const SITE = 'https://www.majestanrealty.com';
export function pathValue(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.length > 512 ||
    !/^\/(?:[a-z0-9%._~!$&'()+,;=@/-]*)$/.test(value) ||
    value.startsWith('//') ||
    /%(?:2f|5c|00|2e)/i.test(value)
  ) {
    throw new BadRequestException(
      'Use an absolute lowercase site path, for example /apartments-for-sale-in-coimbatore',
    );
  }
  const path = value.replace(/\/+$/, '') || '/';
  if (
    path.includes('//') ||
    path.split('/').some((s) => s === '.' || s === '..') ||
    /^\/(admin|api|_next|seo-route|seo-section)(\/|$)/.test(path)
  )
    throw new BadRequestException('Reserved or invalid path');
  return path;
}
export function slug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
export function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value as T;
}
export function hydrate(row: any) {
  if (!row) return null;
  for (const key of [
    'settings',
    'highlights',
    'faqs',
    'schema_overrides',
    'image_alt_overrides',
    'section_seo',
  ])
    row[key] = json(row[key], key === 'faqs' || key === 'highlights' ? [] : {});
  return row;
}
export function renderTemplate(
  input: string | null,
  variables: Record<string, string | number>,
) {
  return (input || '')
    .replace(/\{([A-Za-z_]+)\}/g, (_, key) => String(variables[key] ?? ''))
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '');
}
export function intentWhere(intent: string) {
  return intent === 'rent' ? "p.listing_type='Rent'" : "p.listing_type='Sell'";
}
export function filterKey(row: any) {
  return [
    row.inventory_kind,
    row.transaction_intent,
    row.property_type || row.project_type || 'all',
    row.city_id,
    row.sublocation_id || 0,
    row.bedrooms || 0,
  ].join(':');
}
export function xml(value: unknown) {
  return String(value ?? '').replace(
    /[<>&"']/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[c]!,
  );
}

export const SINGULAR_TYPES: Record<string, string> = {
  apartment: 'Apartment',
  villa: 'Villa',
  individual_portion: 'Independent House',
  plot: 'Plot',
  farmland: 'Farmland',
  commercial: 'Commercial Space',
  industrial: 'Industrial Space',
  coworking: 'Co-Working Space',
};
export function priceLabel(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'Price on request';
  const trim = (v: number) => Number(v.toFixed(2)).toLocaleString('en-IN');
  return n >= 10000000
    ? `₹${trim(n / 10000000)} Cr`
    : n >= 100000
      ? `₹${trim(n / 100000)} Lakh`
      : `₹${n.toLocaleString('en-IN')}`;
}
