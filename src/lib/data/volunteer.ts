import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

// Server-only data helpers for volunteer shifts ("Help out"). Every query runs
// as the signed-in person (RLS applies): everyone reads non-draft shifts whose
// event (if any) is published and visible to them; organizers/admins read everything. Spots taken come from
// get_volunteer_counts() so nobody sees who signed up except organizers.

type ShiftRow = Database["public"]["Tables"]["volunteer_shifts"]["Row"];
type EventStatus = Database["public"]["Enums"]["event_status"];

export type ShiftStatus = "draft" | "open" | "closed";
export const SHIFT_STATUSES: readonly ShiftStatus[] = ["draft", "open", "closed"];
export const SHIFT_STATUS_LABEL: Record<ShiftStatus, string> = { draft: "Draft", open: "Open", closed: "Closed" };
export const toShiftStatus = (s: string): ShiftStatus => (SHIFT_STATUSES as readonly string[]).includes(s) ? (s as ShiftStatus) : "draft";

type ShiftEvent = { id: string; title: string; slug: string; status: EventStatus; starts_at: string };

export type Shift = Pick<ShiftRow, "id" | "event_id" | "title" | "description" | "starts_at" | "ends_at" | "slots"> & {
  status: ShiftStatus;
  is_demo: boolean;
  /** The linked event, when there is one and the viewer can see it. */
  event: ShiftEvent | null;
};

/** A shift as the public "Help out" list shows it. */
export type ShiftView = Shift & {
  taken: number;
  /** The signed-in person is signed up for it. */
  mine: boolean;
  /** The shift has started (nobody can sign up or drop out here anymore). */
  started: boolean;
  /** Sign-ups are over: the shift has started or organizers closed it. */
  closed: boolean;
};

const SHIFT_COLUMNS =
  "id, event_id, title, description, starts_at, ends_at, slots, status, is_demo, event:events(id, title, slug, status, starts_at)";

const HOUR = 60 * 60 * 1000;
/** Shifts stay listed for an hour after they start, so people can still check the time. */
const LIST_GRACE_MS = HOUR;

function toShift(row: Omit<Shift, "status"> & { status: string }): Shift {
  return { ...row, status: toShiftStatus(row.status) };
}

/** True once the shift's start time has passed. */
export function hasStarted(startsAt: string, now: number = Date.now()): boolean {
  return new Date(startsAt).getTime() <= now;
}

/**
 * Why people can't see a shift even when it's Open or Closed: its event is
 * still a draft or was cancelled. Null when the event (if any) is published.
 */
export function hiddenByEventLabel(shift: Pick<Shift, "event">): string | null {
  const status = shift.event?.status;
  if (!status || status === "published") return null;
  return status === "cancelled" ? "Event cancelled" : "Hidden until the event is published";
}

/** Spots taken per shift (no names). Works for anyone; drafts only count for organizers. */
export async function getShiftCounts(ids: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (ids.length === 0) return counts;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_volunteer_counts", { p_shift_ids: ids });
  for (const row of data ?? []) counts.set(row.shift_id, row.taken);
  return counts;
}

/** Which of these shifts the person signed up for (their own rows only, under RLS). */
async function getMySignups(ids: string[], viewerId?: string): Promise<Set<string>> {
  if (!viewerId || ids.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase.from("volunteer_signups").select("shift_id").eq("user_id", viewerId).in("shift_id", ids);
  return new Set((data ?? []).map((r) => r.shift_id));
}

/**
 * Upcoming shifts people can sign up for, soonest first. Closed shifts only show
 * for people already signed up (so they still see their plan). Shifts for an
 * event that is cancelled, still a draft, or hidden from the viewer are left out.
 */
export async function listOpenShifts(
  options: { eventId?: string; viewerId?: string; limit?: number } = {},
): Promise<ShiftView[]> {
  const supabase = await createClient();
  const now = Date.now();
  let query = supabase
    .from("volunteer_shifts")
    .select(SHIFT_COLUMNS)
    .in("status", ["open", "closed"])
    .gte("starts_at", new Date(now - LIST_GRACE_MS).toISOString())
    .order("starts_at", { ascending: true })
    .limit(options.limit ?? 100);
  if (options.eventId) query = query.eq("event_id", options.eventId);
  const { data } = await query;

  const shifts = (data ?? [])
    .map(toShift)
    .filter((s) => !s.event_id || s.event?.status === "published");
  const ids = shifts.map((s) => s.id);
  const [counts, mine] = await Promise.all([getShiftCounts(ids), getMySignups(ids, options.viewerId)]);

  return shifts
    .map((s) => {
      const started = hasStarted(s.starts_at, now);
      return {
        ...s,
        taken: counts.get(s.id) ?? 0,
        mine: mine.has(s.id),
        started,
        closed: s.status !== "open" || started,
      };
    })
    .filter((s) => s.status === "open" || s.mine);
}

// ---------------------------------------------------------------------------
// Organizer dashboard
// ---------------------------------------------------------------------------

export type AdminShift = Shift & { taken: number };

/** Most shifts listShiftsForAdmin returns (the page says so when it's full). */
export const ADMIN_SHIFT_LIMIT = 200;

/** Upcoming (not yet started, or started in the last few hours) or past shifts, for organizers. */
export async function listShiftsForAdmin(tab: "upcoming" | "past"): Promise<AdminShift[]> {
  const supabase = await createClient();
  const cutoff = new Date(Date.now() - 3 * HOUR).toISOString();
  let query = supabase.from("volunteer_shifts").select(SHIFT_COLUMNS).limit(ADMIN_SHIFT_LIMIT);
  query =
    tab === "past"
      ? query.lt("starts_at", cutoff).order("starts_at", { ascending: false })
      : query.gte("starts_at", cutoff).order("starts_at", { ascending: true });
  const { data } = await query;
  const shifts = (data ?? []).map(toShift);
  const counts = await getShiftCounts(shifts.map((s) => s.id));
  return shifts.map((s) => ({ ...s, taken: counts.get(s.id) ?? 0 }));
}

/** Every shift for one event (any status), soonest first, for the admin event page. */
export async function listShiftsForEvent(eventId: string): Promise<AdminShift[]> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("volunteer_shifts")
    .select(SHIFT_COLUMNS)
    .eq("event_id", eventId)
    .order("starts_at", { ascending: true })
    .limit(50);
  const shifts = (data ?? []).map(toShift);
  const counts = await getShiftCounts(shifts.map((s) => s.id));
  return shifts.map((s) => ({ ...s, taken: counts.get(s.id) ?? 0 }));
}

export type ShiftSignup = { user_id: string; name: string; email: string; created_at: string };

/** One shift with everyone signed up (names + emails, first to sign up first). Null when missing. */
export async function getShiftForAdmin(id: string): Promise<(Shift & { signups: ShiftSignup[] }) | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const [{ data: row }, { data: signups }] = await Promise.all([
    supabase.from("volunteer_shifts").select(SHIFT_COLUMNS).eq("id", id).maybeSingle(),
    supabase
      .from("volunteer_signups")
      .select("user_id, created_at, profile:profiles!volunteer_signups_user_id_fkey(full_name, preferred_name, email)")
      .eq("shift_id", id)
      .order("created_at", { ascending: true }),
  ]);
  if (!row) return null;
  return {
    ...toShift(row),
    signups: (signups ?? []).map((s) => ({
      user_id: s.user_id,
      name: s.profile?.full_name?.trim() || s.profile?.preferred_name?.trim() || s.profile?.email || "Unknown",
      email: s.profile?.email ?? "",
      created_at: s.created_at,
    })),
  };
}

export type ShiftEventOption = { id: string; title: string; starts_at: string; status: EventStatus };

/**
 * Events a shift can belong to: upcoming drafts and published events, soonest
 * first, plus the shift's current event (even if it's past) so editing keeps it.
 */
export async function listShiftEventOptions(includeId?: string | null): Promise<ShiftEventOption[]> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 3 * HOUR).toISOString();
  const [{ data: upcoming }, { data: current }] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, status")
      .in("status", ["draft", "published"])
      .gte("starts_at", since)
      .order("starts_at", { ascending: true })
      .limit(100),
    includeId
      ? supabase.from("events").select("id, title, starts_at, status").eq("id", includeId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const list = upcoming ?? [];
  if (current && !list.some((e) => e.id === current.id)) list.unshift(current);
  return list;
}
