export const normalizeArray = (value: unknown): string[] | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .flatMap((item) => {
        const normalized = toPrimitiveString(item);
        return normalized ? normalized.split(',') : [];
      })
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const normalized = toPrimitiveString(value);

  if (!normalized) {
    return undefined;
  }

  return normalized
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

const toPrimitiveString = (input: unknown): string | undefined => {
  if (typeof input === 'string') {
    return input;
  }

  if (
    typeof input === 'number' ||
    typeof input === 'boolean' ||
    typeof input === 'bigint'
  ) {
    return String(input);
  }

  return undefined;
};
