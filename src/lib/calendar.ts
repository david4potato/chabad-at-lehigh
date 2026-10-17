// Pure helpers for the month calendar on /events and the calendar feed.
// Day keys ("2026-10-23") are calendar days in site time (America/New_York).
// Grid arithmetic is done on plain calendar dates in UTC, so daylight saving
// changes can never skip or repeat a day.
import { icsEscape, icsFold, icsStamp } from "@/lib/ics";
import { SITE_TIME_ZONE, siteDateKey, siteLocalToUtcIso } from "@/lib/time";

/** A calendar day in site time, e.g. "2026-10-23". */
export type DayKey = string;
/** A calendar month; `month` is 1-12. */
export type YearMonth = { year: number; month: number };
export type CalendarCell = { key: DayKey; day: number; inMonth: boolean };

const DAY_MS = 24 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");
/** The day key of a UTC calendar date (grid arithmetic only). */
const utcDayKey = (date: Date): DayKey =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/** The most days one event is listed on in the month view (guards against typos in end dates). */
export const MAX_EVENT_SPAN_DAYS = 14;

/** "2026-10" */
export const monthKey = ({ year, month }: YearMonth) => `${year}-${pad(month)}`;

/** Parse "YYYY-MM" from a query string; null when missing or invalid. */
export function parseMonth(value: unknown): YearMonth | null {
  if (typeof value !== "string") return null;
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || year < 2000 || year > 2100) return null;
  return { year, month };
}

/** The month it is right now in site time. */
export function currentMonth(now: Date = new Date()): YearMonth {
  const key = siteDateKey(now);
  return { year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) };
}

/** Move a month forward or back. */
export function addMonths({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (((index % 12) + 12) % 12) + 1 };
}

/** Whole months from `a` to `b` (positive when `b` is later). */
export const monthsBetween = (a: YearMonth, b: YearMonth) => b.year * 12 + b.month - (a.year * 12 + a.month);

/** Keep a month within `before` months back and `after` months ahead of `anchor`. */
export function clampMonth(ym: YearMonth, anchor: YearMonth, before: number, after: number): YearMonth {
  const diff = monthsBetween(anchor, ym);
  if (diff < -before) return addMonths(anchor, -before);
  if (diff > after) return addMonths(anchor, after);
  return ym;
}

export const daysInMonth = ({ year, month }: YearMonth) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/** Parse "YYYY-MM-DD" when it is a real day inside `ym`; otherwise null. */
export function parseDay(value: unknown, ym: YearMonth): DayKey | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (value.slice(0, 7) !== monthKey(ym)) return null;
  const day = Number(value.slice(8));
  return day >= 1 && day <= daysInMonth(ym) ? value : null;
}

/**
 * The weeks shown for a month, Sunday first. Days before the 1st and after the
 * last day (from the neighbouring months) are included with `inMonth: false`,
 * so every week has 7 cells. A month has 4, 5 or 6 weeks.
 */
export function monthGrid(ym: YearMonth): CalendarCell[][] {
  const first = Date.UTC(ym.year, ym.month - 1, 1);
  const lead = new Date(first).getUTCDay(); // 0 = Sunday
  const weekCount = Math.ceil((lead + daysInMonth(ym)) / 7);
  const weeks: CalendarCell[][] = [];
  for (let w = 0; w < weekCount; w++) {
    const week: CalendarCell[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(first + (w * 7 + d - lead) * DAY_MS);
      week.push({
        key: utcDayKey(date),
        day: date.getUTCDate(),
        inMonth: date.getUTCFullYear() === ym.year && date.getUTCMonth() + 1 === ym.month,
      });
    }
    weeks.push(week);
  }
  return weeks;
}

/** UTC instants for midnight at the start and end of a month in site time: [from, to). */
export function monthRange(ym: YearMonth): { from: string; to: string } {
  return {
    from: siteLocalToUtcIso(`${monthKey(ym)}-01T00:00`)!,
    to: siteLocalToUtcIso(`${monthKey(addMonths(ym, 1))}-01T00:00`)!,
  };
}

/**
 * The site-time days an event covers, from its start day to its end day (at
 * most MAX_EVENT_SPAN_DAYS). An event that ends exactly at midnight does not
 * reach the next day; one with no (or a nonsensical) end covers its start day.
 */
export function eventDays(startsAt: string, endsAt?: string | null): DayKey[] {
  const start = Date.parse(startsAt);
  const end = endsAt ? Date.parse(endsAt) : NaN;
  const first = siteDateKey(start);
  const last = end > start ? siteDateKey(end - 1) : first;
  const days = [first];
  let day = first;
  while (day < last && days.length < MAX_EVENT_SPAN_DAYS) {
    day = utcDayKey(new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS));
    days.push(day);
  }
  return days;
}

/**
 * Group events under every site-time day they cover (see eventDays), keeping
 * their order, so a Friday-to-Saturday Shabbaton is listed on both days. With
 * `within`, days outside that month are left out.
 */
export function groupByDay<T extends { starts_at: string; ends_at?: string | null }>(
  events: T[],
  within?: YearMonth,
): Map<DayKey, T[]> {
  const month = within ? monthKey(within) : null;
  const map = new Map<DayKey, T[]>();
  for (const event of events) {
    for (const key of eventDays(event.starts_at, event.ends_at)) {
      if (month && key.slice(0, 7) !== month) continue;
      const list = map.get(key);
      if (list) list.push(event);
      else map.set(key, [event]);
    }
  }
  return map;
}

/**
 * The day listed under the grid: the requested day, else today when it is in
 * this month, else the first day with events, else none.
 */
export function pickSelectedDay(
  ym: YearMonth,
  requested: DayKey | null,
  today: DayKey,
  eventDays: Iterable<DayKey>,
): DayKey | null {
  if (requested) return requested;
  if (today.slice(0, 7) === monthKey(ym)) return today;
  return [...eventDays].sort()[0] ?? null;
}

/** The first day with events after `day`, if any. */
export const nextEventDay = (day: DayKey, eventDays: Iterable<DayKey>): DayKey | null =>
  [...eventDays].filter((k) => k > day).sort()[0] ?? null;

// -----------------------------------------------------------------------------
// Calendar feed (.ics subscription)
// -----------------------------------------------------------------------------

export type FeedEvent = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  starts_at: string;
  ends_at: string | null;
  location_name: string | null;
  location_address: string | null;
};

const TWO_HOURS = 2 * 60 * 60 * 1000;

/** A VCALENDAR feed of events (same event format as the single-event download). */
export function buildCalendarFeed(
  events: FeedEvent[],
  options: { siteUrl: string; name: string; description?: string; now?: Date },
): string {
  const stamp = icsStamp(options.now ?? new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chabad at Lehigh//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(options.name)}`,
    ...(options.description ? [`X-WR-CALDESC:${icsEscape(options.description)}`] : []),
    `X-WR-TIMEZONE:${SITE_TIME_ZONE}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const event of events) {
    const start = new Date(event.starts_at);
    const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + TWO_HOURS);
    const url = `${options.siteUrl}/events/${event.slug}`;
    const location = [event.location_name, event.location_address].filter(Boolean).join(", ");
    const description = [event.summary, url].filter(Boolean).join("\n\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id}@chabad-at-lehigh`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsStamp(start)}`,
      `DTEND:${icsStamp(end)}`,
      `SUMMARY:${icsEscape(event.title)}`,
      ...(location ? [`LOCATION:${icsEscape(location)}`] : []),
      `DESCRIPTION:${icsEscape(description)}`,
      `URL:${url}`,
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return lines.map(icsFold).join("\r\n") + "\r\n";
}

/** webcal:// link that calendar apps (Apple, Outlook) open as a subscription. */
export const webcalUrl = (httpUrl: string) => httpUrl.replace(/^https?:\/\//i, "webcal://");

/** Google Calendar "add by URL" link for a feed. */
export const googleCalendarSubscribeUrl = (httpUrl: string) =>
  `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl(httpUrl))}`;
