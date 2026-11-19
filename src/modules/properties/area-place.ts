/**
 * Area matching for listing searches. Master Registry and project records sometimes store an area
 * with its city or a trailing comma ("Medavakkam, Chennai", "Electronic City,"), while listing URLs
 * use the bare area ("medavakkam"). Both sides are compared without those, so one URL finds them all.
 */

/** The searched area: lowercase, hyphens as spaces, with no trailing comma or ", <city>". */
export function areaPlace(location: string, city?: string): string {
  const value = location
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[,\s]+$/, '');
  const cityValue = city
    ?.toLowerCase()
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cityValue && value.endsWith(', ' + cityValue))
    return value.slice(0, -(cityValue.length + 2)).trim() || value;
  return value;
}

/** SQL matching a stored area column to `:param` (an areaPlace value), alone or followed by its city. */
export function areaMatches(
  column: string,
  cityColumn: string,
  param: string,
): string {
  const stored = `LOWER(REPLACE(REPLACE(TRIM(TRAILING ',' FROM TRIM(${column})), '-', ' '), '  ', ' '))`;
  return `${stored} IN (:${param}, CONCAT(:${param}, ', ', LOWER(TRIM(${cityColumn}))))`;
}
