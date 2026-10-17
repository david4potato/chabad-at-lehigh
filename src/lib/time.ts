// All event times are shown in Bethlehem, PA time regardless of where the
// server runs (Vercel servers use UTC).
export const SITE_TIME_ZONE = "America/New_York";

type DateInput = string | number | Date;
const toDate = (d: DateInput) => (d instanceof Date ? d : new Date(d));

const fmt = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: SITE_TIME_ZONE, ...options });

const weekdayDate = fmt({ weekday: "long", month: "long", day: "numeric" });
const shortDate = fmt({ weekday: "short", month: "short", day: "numeric" });
const timeOnly = fmt({ hour: "numeric", minute: "2-digit" });
const fullDateTime = fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const ymdParts = fmt({ year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** "Friday, October 23" */
export const formatLongDate = (d: DateInput) => weekdayDate.format(toDate(d));
/** "Fri, Oct 23" */
export const formatShortDate = (d: DateInput) => shortDate.format(toDate(d));
/** "6:30 PM" */
export const formatTime = (d: DateInput) => timeOnly.format(toDate(d));
/** "Fri, Oct 23, 6:30 PM" */
export const formatDateTime = (d: DateInput) => fullDateTime.format(toDate(d));

/**
 * "6:30 PM – 9:00 PM" (falls back to start time only). When the end is on a
 * different day in site time: "Fri, Oct 23, 6:00 PM – Sat, Oct 24, 9:00 PM".
 */
export function formatTimeRange(start: DateInput, end?: DateInput | null): string {
  if (!end) return formatTime(start);
  if (spansDays(start, end)) return `${formatDateTime(start)} – ${formatDateTime(end)}`;
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** True when the end falls on a later calendar day than the start, in site time. */
export function spansDays(start: DateInput, end?: DateInput | null): boolean {
  return Boolean(end) && toDateTimeLocalValue(start).slice(0, 10) !== toDateTimeLocalValue(end).slice(0, 10);
}

/** "Friday, October 23 · 6:30 PM – 9:00 PM", or just the range when it spans days (it has the dates). */
export function formatEventWhen(start: DateInput, end?: DateInput | null): string {
  const range = formatTimeRange(start, end);
  return spansDays(start, end) ? range : `${formatLongDate(start)} · ${range}`;
}

function zonedParts(d: Date) {
  const parts = Object.fromEntries(ymdParts.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** Value for <input type="datetime-local"> in site time, e.g. "2026-10-23T18:30". */
export function toDateTimeLocalValue(d: DateInput | null | undefined): string {
  if (!d) return "";
  const p = zonedParts(toDate(d));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Convert a datetime-local value typed in site time ("2026-10-23T18:30") into
 * a UTC ISO string. Handles daylight saving time without extra libraries.
 */
export function siteLocalToUtcIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  // Reject impossible values (Feb 30, month 13, 25:00) instead of rolling over.
  const check = new Date(Date.UTC(y, mo - 1, d, h, mi));
  if (
    check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d ||
    check.getUTCHours() !== h || check.getUTCMinutes() !== mi
  ) {
    return null;
  }
  // Start from the same wall-clock time in UTC, then correct by the zone offset
  // (twice, to settle correctly around DST transitions).
  const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wallAsUtc;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(guess));
    const shownAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += wallAsUtc - shownAsUtc;
  }
  return new Date(guess).toISOString();
}

/** True when the event has finished (or started more than 3 hours ago if no end time). */
export function isPast(startsAt: DateInput, endsAt?: DateInput | null, now: Date = new Date()): boolean {
  const end = endsAt ? toDate(endsAt) : new Date(toDate(startsAt).getTime() + 3 * 60 * 60 * 1000);
  return end.getTime() < now.getTime();
}

/** "Today", "Tomorrow", or "in 3 days" relative to site time. */
export function relativeDay(d: DateInput, now: Date = new Date()): string | null {
  const a = zonedParts(toDate(d));
  const b = zonedParts(now);
  const dayA = Date.UTC(a.year, a.month - 1, a.day);
  const dayB = Date.UTC(b.year, b.month - 1, b.day);
  const diff = Math.round((dayA - dayB) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return null;
}
