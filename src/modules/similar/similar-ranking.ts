/**
 * Ranking for "Similar Properties" / "Similar Projects", kept free of TypeORM
 * so the rules can be tested directly.
 *
 * Similarity is a strict priority list, not a points total: a candidate that
 * matches a higher criterion always ranks above one that doesn't, however
 * many lower criteria the other matches. So the closest matches (same
 * possession status, then same configuration, then same locality…) lead,
 * and the rail then steps down to less similar listings in order. Newest
 * breaks ties.
 */

export const SIMILAR_LIMIT = 8;
/** Prices within ±25% of the current listing count as "similar". */
const PRICE_BAND = 0.25;

export type Criterion<T> = {
  /** Whether candidate `c` shares this trait with `base`. */
  match: (base: T, c: T) => boolean;
  /** Short reason shown on the card when it matches; null = not shown. */
  label: (base: T, c: T) => string | null;
};

export type Ranked<T> = { item: T; matches: string[] };

const norm = (v: string | null | undefined) =>
  (v ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const same = (a: string | null | undefined, b: string | null | undefined) => !!norm(a) && norm(a) === norm(b);

const titleCase = (v: string) => v.replace(/[_-]+/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()).trim();

/** "ready_to_move" / "Ready to Move" → "Ready to move". */
export const possessionLabel = (v: string | null | undefined): string | null => {
  const key = norm(v);
  if (!key) return null;
  const known: Record<string, string> = {
    ready_to_move: 'Ready to move',
    under_construction: 'Under construction',
    new_launch: 'New launch',
  };
  if (known[key]) return known[key];
  const words = key.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const withinBand = (price: number | null, target: number | null) =>
  price != null && target != null && target > 0 && Math.abs(price - target) <= target * PRICE_BAND;

export function rankByPriority<T extends { id: number; createdAt: number }>(
  base: T,
  candidates: T[],
  criteria: Criterion<T>[],
  limit = SIMILAR_LIMIT,
): Ranked<T>[] {
  const n = criteria.length;
  return candidates
    .filter((c) => c.id !== base.id)
    .map((c) => {
      let score = 0;
      const matches: string[] = [];
      criteria.forEach((criterion, i) => {
        if (!criterion.match(base, c)) return;
        // Each criterion outweighs every criterion below it combined.
        score += 2 ** (n - 1 - i);
        const label = criterion.label(base, c);
        if (label) matches.push(label);
      });
      return { item: c, matches, score };
    })
    .sort((a, b) => b.score - a.score || b.item.createdAt - a.item.createdAt)
    .slice(0, limit)
    .map(({ item, matches }) => ({ item, matches }));
}

/* ── Properties ───────────────────────────────────────────────────── */

export type PropertyTraits = {
  id: number;
  propertyType: string;
  listingType: string | null;
  possession: string | null;
  bedrooms: number | null;
  sublocation: string | null;
  city: string | null;
  price: number | null;
  condition: string | null;
  createdAt: number;
};

export const PROPERTY_CRITERIA: Criterion<PropertyTraits>[] = [
  { match: (b, c) => same(b.propertyType, c.propertyType), label: () => null },
  { match: (b, c) => same(b.listingType, c.listingType), label: () => null },
  { match: (b, c) => same(b.possession, c.possession), label: (b) => possessionLabel(b.possession) },
  {
    match: (b, c) => b.bedrooms != null && b.bedrooms === c.bedrooms,
    label: (b) => `${b.bedrooms} BHK`,
  },
  { match: (b, c) => same(b.sublocation, c.sublocation), label: (b) => `In ${b.sublocation!.trim()}` },
  { match: (b, c) => withinBand(c.price, b.price), label: () => 'Similar price' },
  { match: (b, c) => same(b.city, c.city), label: () => null },
  { match: (b, c) => same(b.condition, c.condition), label: (b) => titleCase(b.condition ?? '') || null },
];

/* ── Projects ─────────────────────────────────────────────────────── */

export type ProjectTraits = {
  id: number;
  projectType: string;
  possession: string | null;
  bhk: number[];
  sublocation: string | null;
  city: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  createdAt: number;
};

const sharedBhk = (a: number[], b: number[]) => a.filter((n) => n > 0 && b.includes(n));

const pricesOverlap = (b: ProjectTraits, c: ProjectTraits) =>
  b.minPrice != null && b.maxPrice != null && c.minPrice != null && c.maxPrice != null
    ? c.minPrice <= b.maxPrice * (1 + PRICE_BAND) && c.maxPrice >= b.minPrice * (1 - PRICE_BAND)
    : withinBand(c.minPrice, b.minPrice);

export const PROJECT_CRITERIA: Criterion<ProjectTraits>[] = [
  { match: (b, c) => same(b.projectType, c.projectType), label: () => null },
  { match: (b, c) => same(b.possession, c.possession), label: (b) => possessionLabel(b.possession) },
  {
    match: (b, c) => sharedBhk(b.bhk, c.bhk).length > 0,
    label: (b, c) => {
      const shared = [...new Set(sharedBhk(b.bhk, c.bhk))].sort((x, y) => x - y);
      return `${shared.join(', ')} BHK`;
    },
  },
  { match: (b, c) => same(b.sublocation, c.sublocation), label: (b) => `In ${b.sublocation!.trim()}` },
  { match: (b, c) => pricesOverlap(b, c), label: () => 'Similar price' },
  { match: (b, c) => same(b.city, c.city), label: () => null },
];
