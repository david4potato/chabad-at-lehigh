import { siteLocalToUtcIso, toDateTimeLocalValue } from "@/lib/time";

const DAY = 24 * 60 * 60 * 1000;

/** Adds days to a "YYYY-MM-DD" date. No clock is involved, so daylight saving can't shift the day. */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Moves a time by whole days on the campus calendar, keeping its clock time across daylight saving. */
export function shiftLocalDays(iso: string, days: number): string {
  const local = toDateTimeLocalValue(iso);
  return (
    siteLocalToUtcIso(`${addDays(local.slice(0, 10), days)}T${local.slice(11)}`) ??
    new Date(new Date(iso).getTime() + days * DAY).toISOString()
  );
}

/** Whole days on the campus calendar from the date of `fromIso` to the date of `toIso`. */
export function localDaysBetween(fromIso: string, toIso: string): number {
  const day = (iso: string) => {
    const [y, m, d] = toDateTimeLocalValue(iso).slice(0, 10).split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((day(toIso) - day(fromIso)) / DAY);
}

/**
 * The next `count` start times after `startsAt`, every `everyWeeks` weeks, on the same weekday and at
 * the same clock time on campus (a 7 PM dinner stays at 7 PM across daylight-saving changes).
 * Dates already past are skipped, so an old event repeats from the first date still ahead.
 */
export function repeatStarts(startsAt: string, everyWeeks: number, count: number, now: Date = new Date()): string[] {
  const starts: string[] = [];
  // Bounded so a very old event can't loop for long: 40 years of weekly dates.
  for (let k = 1; starts.length < count && k <= 2100; k++) {
    const iso = shiftLocalDays(startsAt, k * everyWeeks * 7);
    if (new Date(iso).getTime() > now.getTime()) starts.push(iso);
  }
  return starts;
}
