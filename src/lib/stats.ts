// A few calm numbers: "Your activity" on the profile (get_my_stats) and
// "This semester" on the dashboard (get_staff_stats). The SQL does the
// counting; this file only reads the JSON safely and works out dates.
import { formatMonthYear, siteDateKey, siteLocalToUtcIso } from "@/lib/time";

export type MyStats = {
  events: number;
  shabbatDinners: number;
  helped: number;
  /** First event attended (UTC ISO), or null. */
  since: string | null;
  last: { title: string; slug: string; startsAt: string } | null;
};

export type StaffStats = {
  eventsHeld: number;
  shabbatDinners: number;
  people: number;
  newPeople: number;
  avgShabbat: number;
  volunteerSignups: number;
};

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const count = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/** Read the jsonb from get_my_stats(). Anything missing or odd becomes 0 / null. */
export function parseMyStats(data: unknown): MyStats {
  const o = asObject(data);
  const last = asObject(o.last);
  const title = text(last.title);
  const slug = text(last.slug);
  const startsAt = text(last.starts_at);
  return {
    events: count(o.events),
    shabbatDinners: count(o.shabbat_dinners),
    helped: count(o.helped),
    since: text(o.since),
    last: title && slug && startsAt ? { title, slug, startsAt } : null,
  };
}

/** False when every number is zero (show a friendly line instead of zeros). */
export function hasActivity(s: MyStats): boolean {
  return s.events > 0 || s.shabbatDinners > 0 || s.helped > 0;
}

/** Read the jsonb from get_staff_stats(). */
export function parseStaffStats(data: unknown): StaffStats {
  const o = asObject(data);
  return {
    eventsHeld: count(o.events_held),
    shabbatDinners: count(o.shabbat_dinners),
    people: count(o.people),
    newPeople: count(o.new_people),
    avgShabbat: count(o.avg_shabbat),
    volunteerSignups: count(o.volunteer_signups),
  };
}

/**
 * Start of the current semester in Bethlehem time, as a UTC ISO string:
 * August 1 for August–December, January 1 for January–July.
 */
export function semesterStart(now: Date = new Date()): string {
  const [year, month] = siteDateKey(now).split("-").map(Number);
  const local = month >= 8 ? `${year}-08-01T00:00` : `${year}-01-01T00:00`;
  // Always a valid wall-clock time, so this never falls back in practice.
  return siteLocalToUtcIso(local) ?? new Date(Date.UTC(year, month >= 8 ? 7 : 0, 1, 12)).toISOString();
}

/** "October 2026" for an instant, in Bethlehem time. */
export function formatSince(iso: string): string {
  const [year, month] = siteDateKey(iso).split("-").map(Number);
  return formatMonthYear(year, month);
}
