const SUFFIX_MULTIPLIER_MAP: Record<string, number> = {
  k: 1_000,
  l: 100_000,
  c: 10_000_000,
};

export const parseIndianNumber = (value: string): number => {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return 0;
  }

  const suffix = normalized.slice(-1);
  const multiplier = SUFFIX_MULTIPLIER_MAP[suffix];

  if (!multiplier) {
    return Number.parseFloat(normalized) || 0;
  }

  const baseValue = Number.parseFloat(normalized.slice(0, -1));
  return Number.isFinite(baseValue) ? baseValue * multiplier : 0;
};
