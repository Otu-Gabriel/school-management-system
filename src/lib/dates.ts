/** Parse YYYY-MM-DD as a UTC calendar date (no timezone shift). */
export function parseDateOnly(value: string | Date) {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
    );
  }
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function todayDateOnlyString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function compareDateOnly(a: Date, b: Date) {
  return a.getTime() - b.getTime();
}

export function isDateWithinInclusive(
  date: Date | string,
  start: Date | string,
  end: Date | string
) {
  const d = parseDateOnly(date).getTime();
  return d >= parseDateOnly(start).getTime() && d <= parseDateOnly(end).getTime();
}
