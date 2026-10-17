import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// Server-only data helpers for events, RSVPs and the home feed. Every query
// runs as the signed-in person (RLS applies). Counts and RSVPs for a list of
// events are always fetched in one batch, never per event.

type Enums = Database["public"]["Enums"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];

export type EventCategory = Enums["event_category"];
export type EventStatus = Enums["event_status"];
export type RsvpStatus = Enums["rsvp_status"];
export type GuestStatus = Enums["guest_status"];
export type ApprovalMode = Enums["approval_mode"];

const SUMMARY_COLUMNS =
  "id, slug, title, summary, category, status, starts_at, ends_at, location_name, capacity, rsvp_enabled, rsvp_deadline";

const DETAIL_COLUMNS =
  "id, slug, title, summary, description, category, status, visibility, starts_at, ends_at, location_name, location_address, capacity, rsvp_enabled, rsvp_deadline, approval_mode, max_guests_per_rsvp, has_meal, menu_voting_open, contact_name, contact_email, contact_phone";

/** The fields event lists and cards need. */
export type EventSummary = Pick<
  EventRow,
  | "id"
  | "slug"
  | "title"
  | "summary"
  | "category"
  | "status"
  | "starts_at"
  | "ends_at"
  | "location_name"
  | "capacity"
  | "rsvp_enabled"
  | "rsvp_deadline"
>;

/** Everything the event page and the Shabbat card need. */
export type EventDetail = EventSummary &
  Pick<
    EventRow,
    | "description"
    | "visibility"
    | "location_address"
    | "approval_mode"
    | "max_guests_per_rsvp"
    | "has_meal"
    | "menu_voting_open"
    | "contact_name"
    | "contact_email"
    | "contact_phone"
  >;

export type EventCounts = {
  going: number;
  guests: number;
  seatsTaken: number;
  waitlist: number;
  pending: number;
};

export type MyRsvp = {
  event_id: string;
  status: RsvpStatus;
  guest_count: number;
  guest_names: string | null;
  guest_status: GuestStatus;
  note: string | null;
};

export type MyEventEntry = MyRsvp & { event: EventSummary };

const HOUR = 60 * 60 * 1000;

// An event is over once it ends, or 3 hours after it starts when it has no end
// time (same rule as the database).
function upcomingFilter(now = new Date()) {
  const nowIso = now.toISOString();
  const graceIso = new Date(now.getTime() - 3 * HOUR).toISOString();
  return `ends_at.gte."${nowIso}",and(ends_at.is.null,starts_at.gte."${graceIso}")`;
}

function pastFilter(now = new Date()) {
  const nowIso = now.toISOString();
  const graceIso = new Date(now.getTime() - 3 * HOUR).toISOString();
  return `ends_at.lt."${nowIso}",and(ends_at.is.null,starts_at.lt."${graceIso}")`;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Upcoming published (and cancelled) events, soonest first. */
export async function listUpcomingEvents(
  options: { category?: EventCategory; limit?: number } = {},
): Promise<EventSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select(SUMMARY_COLUMNS)
    .in("status", ["published", "cancelled"])
    .or(upcomingFilter())
    .order("starts_at", { ascending: true })
    .limit(options.limit ?? 60);
  if (options.category) query = query.eq("category", options.category);
  const { data } = await query;
  return (data ?? []) as EventSummary[];
}

/** Recent past events, most recent first. */
export async function listPastEvents(
  options: { category?: EventCategory; limit?: number } = {},
): Promise<EventSummary[]> {
  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select(SUMMARY_COLUMNS)
    .eq("status", "published")
    .or(pastFilter())
    .order("starts_at", { ascending: false })
    .limit(options.limit ?? 20);
  if (options.category) query = query.eq("category", options.category);
  const { data } = await query;
  return (data ?? []) as EventSummary[];
}

/**
 * One event by slug (published, cancelled, or a draft when the viewer is
 * staff — RLS decides). Cached per request so metadata and page share it.
 */
export const getEventBySlug = cache(async (slug: string): Promise<EventDetail | null> => {
  if (!SLUG_RE.test(slug) || slug.length > 80) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("events").select(DETAIL_COLUMNS).eq("slug", slug).maybeSingle();
  return (data as EventDetail | null) ?? null;
});

/** The next Shabbat dinner that hasn't ended yet (published or cancelled). */
export async function getNextShabbatDinner(): Promise<EventDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(DETAIL_COLUMNS)
    .eq("category", "shabbat_dinner")
    .in("status", ["published", "cancelled"])
    .or(upcomingFilter())
    .order("starts_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as EventDetail | null) ?? null;
}

/** Public RSVP counts for many events in one call. */
export async function getEventCounts(eventIds: string[]): Promise<Map<string, EventCounts>> {
  const map = new Map<string, EventCounts>();
  if (eventIds.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_event_counts", { p_event_ids: eventIds });
  for (const row of data ?? []) {
    map.set(row.event_id, {
      going: row.going,
      guests: row.guests,
      seatsTaken: row.seats_taken,
      waitlist: row.waitlist,
      pending: row.pending,
    });
  }
  return map;
}

/** The viewer's own RSVPs for the given events, in one query. */
export async function getMyRsvps(userId: string, eventIds: string[]): Promise<Map<string, MyRsvp>> {
  const map = new Map<string, MyRsvp>();
  if (eventIds.length === 0) return map;
  const supabase = await createClient();
  // Filter by user explicitly: organizers can read everyone's RSVPs.
  const { data } = await supabase
    .from("rsvps")
    .select("event_id, status, guest_count, guest_names, guest_status, note")
    .eq("user_id", userId)
    .in("event_id", eventIds);
  for (const row of data ?? []) map.set(row.event_id, row);
  return map;
}

/** Counts + the viewer's RSVPs for a set of events (two queries, in parallel). */
export async function getEventsMeta(eventIds: string[], userId: string | null | undefined) {
  const ids = [...new Set(eventIds)];
  const [counts, rsvps] = await Promise.all([
    getEventCounts(ids),
    userId ? getMyRsvps(userId, ids) : Promise.resolve(new Map<string, MyRsvp>()),
  ]);
  return { counts, rsvps };
}

/** The viewer's RSVPs split into upcoming, not going, and past attended. */
export async function getMyEvents(userId: string): Promise<{
  upcoming: MyEventEntry[];
  notGoing: MyEventEntry[];
  past: MyEventEntry[];
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("rsvps")
    .select(
      "event_id, status, guest_count, guest_names, guest_status, note, event:events!inner(id, slug, title, summary, category, status, starts_at, ends_at, location_name, capacity, rsvp_enabled, rsvp_deadline)",
    )
    .eq("user_id", userId);

  const now = Date.now();
  const isOver = (e: EventSummary) =>
    (e.ends_at ? new Date(e.ends_at).getTime() : new Date(e.starts_at).getTime() + 3 * HOUR) < now;

  const entries = (data ?? [])
    .filter((row) => row.event && row.event.status !== "draft")
    .map((row) => row as MyEventEntry)
    .sort((a, b) => a.event.starts_at.localeCompare(b.event.starts_at));

  const upcoming: MyEventEntry[] = [];
  const notGoing: MyEventEntry[] = [];
  const past: MyEventEntry[] = [];
  for (const entry of entries) {
    if (isOver(entry.event)) {
      if (entry.status === "going" && entry.event.status === "published") past.push(entry);
    } else if (entry.status === "going" || entry.status === "waitlist" || entry.status === "pending") {
      upcoming.push(entry);
    } else {
      notGoing.push(entry);
    }
  }
  return { upcoming, notGoing, past: past.reverse().slice(0, 20) };
}

/** The viewer's private meal preference for one event (owner-only via RLS). */
export async function getMyMealPreference(eventId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("event_meal_preferences")
    .select("preference, guest_dietary_notes")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .maybeSingle();
  return data ?? null;
}

// -----------------------------------------------------------------------------
// Home feed: announcements and urgent notifications
// -----------------------------------------------------------------------------

export type AnnouncementItem = {
  id: string;
  title: string;
  body: string | null;
  is_pinned: boolean;
  is_urgent: boolean;
  publish_at: string;
  event: { slug: string; title: string } | null;
};

/** Current announcements, pinned first, newest next. */
export async function listAnnouncements(limit = 50): Promise<AnnouncementItem[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  // RLS already hides drafts/expired posts from everyone except organizers;
  // these filters make organizers see exactly what everyone else sees.
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, is_pinned, is_urgent, publish_at, event:events(slug, title)")
    .eq("status", "published")
    .lte("publish_at", nowIso)
    .or(`expires_at.is.null,expires_at.gt."${nowIso}"`)
    .order("is_pinned", { ascending: false })
    .order("publish_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AnnouncementItem[];
}

export type UrgentNotification = { id: string; title: string; body: string | null; link: string | null };

/** Up to 3 unread urgent notifications for the viewer. */
export async function getUrgentNotifications(userId: string): Promise<UrgentNotification[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link")
    .eq("user_id", userId)
    .eq("is_urgent", true)
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(3);
  return data ?? [];
}
