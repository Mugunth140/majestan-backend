export interface RangeUnitInput {
  price?: string | number | null;
  builtupAreaSqft?: string | number | null;
  carpetAreaSqft?: string | number | null;
  superBuiltupAreaSqft?: string | number | null;
  bedrooms?: number | null;
  status?: string | null;
}

export interface ProjectRanges {
  minPrice: number | null;
  maxPrice: number | null;
  minArea: number | null;
  maxArea: number | null;
  bhk: number[];
  unitsCount: number;
}

const toPositiveNumber = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
};

export function computeProjectRanges(units: RangeUnitInput[]): ProjectRanges {
  const empty: ProjectRanges = {
    minPrice: null,
    maxPrice: null,
    minArea: null,
    maxArea: null,
    bhk: [],
    unitsCount: 0,
  };
  if (!units || units.length === 0) return empty;
  const available = units.filter((u) => !u.status || u.status === 'available');
  if (available.length === 0) return empty;
  const prices = available
    .map((u) => toPositiveNumber(u.price))
    .filter((n): n is number => n !== null);
  const areas = available
    .map((u) => toPositiveNumber(u.builtupAreaSqft ?? u.carpetAreaSqft ?? u.superBuiltupAreaSqft))
    .filter((n): n is number => n !== null);
  const bhk = Array.from(
    new Set(
      available
        .map((u) => (typeof u.bedrooms === 'number' ? u.bedrooms : Number(u.bedrooms)))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ).sort((a, b) => a - b);
  return {
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: prices.length ? Math.max(...prices) : null,
    minArea: areas.length ? Math.min(...areas) : null,
    maxArea: areas.length ? Math.max(...areas) : null,
    bhk,
    unitsCount: available.length,
  };
}
