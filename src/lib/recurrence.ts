import { siteLocalToUtcIso, toDateTimeLocalValue } from "@/lib/time";

const DAY = 24 * 60 * 60 * 1000;

/** Adds days to a "YYYY-MM-DD" date. No clock is involved, so daylight saving can't shift the day. */
function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * The next `count` start times after `startsAt`, every `everyWeeks` weeks, on the same weekday and at
 * the same clock time on campus (a 7 PM dinner stays at 7 PM across daylight-saving changes).
 * Dates already past are skipped, so an old event repeats from the first date still ahead.
 */
export function repeatStarts(startsAt: string, everyWeeks: number, count: number, now: Date = new Date()): string[] {
  const local = toDateTimeLocalValue(startsAt);
  const [day, time] = [local.slice(0, 10), local.slice(11)];
  const starts: string[] = [];
  // Bounded so a very old event can't loop for long: 40 years of weekly dates.
  for (let k = 1; starts.length < count && k <= 2100; k++) {
    const iso =
      siteLocalToUtcIso(`${addDays(day, k * everyWeeks * 7)}T${time}`) ??
      new Date(new Date(startsAt).getTime() + k * everyWeeks * 7 * DAY).toISOString();
    if (new Date(iso).getTime() > now.getTime()) starts.push(iso);
  }
  return starts;
}
