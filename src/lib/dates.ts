/**
 * Date formatting helpers used across the dashboard. Centralised here so
 * every list/card/sheet uses the same locale + format and a future tweak
 * (e.g. respect tenant locale) lives in one place.
 *
 * AGENTS.md note: never `Date.getHours()` etc. for business-hour logic —
 * always pass timezone explicitly. These helpers only do *display* of
 * civil dates (no clock-time), so they read fine in any tenant TZ.
 */

const SHORT = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const LONG = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** Render an ISO date / datetime as "10 ene 2026". Returns "—" on null
 *  or invalid input so callers don't have to null-guard every cell. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return SHORT.format(d);
}

/** Same as `formatDate` but for ISO date strings (YYYY-MM-DD) that should
 *  be treated as civil-date (no UTC drift). Falls back to "Sin fecha". */
export function formatDateLong(value: string | null | undefined): string {
  if (!value) return "Sin fecha";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return LONG.format(d);
}

/** Today's date as `YYYY-MM-DD` in browser-local TZ. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True when `value` is today's civil date (YYYY-MM-DD, browser TZ). */
export function isToday(value: string | null | undefined): boolean {
  return value != null && value === todayISO();
}

/** True when `value` is strictly before today's civil date. */
export function isPastDate(value: string | null | undefined): boolean {
  if (!value) return false;
  return value < todayISO();
}
