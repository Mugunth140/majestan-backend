/**
 * Analytics days run on India time: a day starts at 00:00 IST (18:30 UTC the
 * evening before). Events are stored in UTC, so ranges and day labels shift
 * by the IST offset.
 */
const IST_OFFSET_MS = 330 * 60_000;

/** A UTC timestamp column as its IST calendar day, for DuckDB. */
export const istDaySql = (column: string) =>
  `strftime(${column} + INTERVAL 330 MINUTE,'%Y-%m-%d')`;

/** The UTC instant 00:00 IST on `day` (YYYY-MM-DD) begins, as 'YYYY-MM-DD HH:MM:SS'. */
export const istDayStart = (day: string) =>
  new Date(Date.parse(day) - IST_OFFSET_MS)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');

/** The IST calendar day an instant falls on. */
export const istDayOf = (at: Date | number | string) =>
  new Date(new Date(at).getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);

export const ANALYTICS_TIMEZONE = 'Asia/Kolkata';
