// Pure helpers shared by event Server and Client Components (no server-only
// imports here, so the RSVP panel can use them in the browser).
import { SITE_TIME_ZONE, isPast } from "@/lib/time";
import type {
  ApprovalMode,
  EventCategory,
  EventCounts,
  EventStatus,
  GuestStatus,
  RsvpStatus,
} from "@/lib/data/events";

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  shabbat_dinner: "Shabbat dinner",
  holiday: "Holiday",
  learning: "Learning",
  social: "Social",
  volunteer: "Volunteer",
  other: "Other",
};

/** Filter chips on /events (plural labels read better there). */
export const CATEGORY_FILTERS: { value: EventCategory; label: string }[] = [
  { value: "shabbat_dinner", label: "Shabbat dinners" },
  { value: "holiday", label: "Holidays" },
  { value: "learning", label: "Learning" },
  { value: "social", label: "Social" },
  { value: "volunteer", label: "Volunteer" },
  { value: "other", label: "Other" },
];

export const isEventCategory = (value: unknown): value is EventCategory =>
  typeof value === "string" && value in CATEGORY_LABELS;

export type BadgeTone = "neutral" | "brand" | "gold" | "green" | "red" | "amber";

export const RSVP_BADGES: Record<RsvpStatus, { label: string; tone: BadgeTone }> = {
  going: { label: "Going", tone: "green" },
  waitlist: { label: "Waitlist", tone: "amber" },
  pending: { label: "Awaiting approval", tone: "brand" },
  not_going: { label: "Not going", tone: "neutral" },
  declined: { label: "Not confirmed", tone: "red" },
};

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "+2 guests", "2 guests awaiting approval", or null. */
export function guestSummary(guestCount: number, guestStatus: GuestStatus): string | null {
  if (guestCount <= 0) return null;
  const guests = plural(guestCount, "guest");
  if (guestStatus === "approved") return `+${guests}`;
  if (guestStatus === "pending") return `${guests} awaiting approval`;
  if (guestStatus === "declined") return `${guests} not confirmed`;
  return null;
}

export type RsvpClosedReason = "draft" | "cancelled" | "ended" | "closed" | "deadline" | null;

/** Why RSVPs can't be changed right now (mirrors the checks in set_rsvp). */
export function rsvpClosedReason(
  event: {
    status: EventStatus;
    starts_at: string;
    ends_at: string | null;
    rsvp_enabled: boolean;
    rsvp_deadline: string | null;
  },
  now: Date = new Date(),
): RsvpClosedReason {
  if (event.status === "draft") return "draft";
  if (event.status === "cancelled") return "cancelled";
  if (isPast(event.starts_at, event.ends_at, now)) return "ended";
  if (!event.rsvp_enabled) return "closed";
  if (event.rsvp_deadline && new Date(event.rsvp_deadline).getTime() < now.getTime()) return "deadline";
  return null;
}

export const CLOSED_MESSAGES: Record<Exclude<RsvpClosedReason, null>, string> = {
  draft: "RSVPs open once this event is published.",
  cancelled: "This event has been cancelled.",
  ended: "This event has ended.",
  closed: "RSVPs are closed for this event. Questions? Contact the organizer.",
  deadline: "The RSVP deadline has passed. Questions? Contact the organizer.",
};

/**
 * After the deadline (or when RSVPs are closed) people can still cancel, so
 * those with a spot see this with an "I can't make it" button.
 */
export const CANCEL_AFTER_CLOSE_MESSAGE = "New RSVPs are closed. If you can't make it, please let us know below.";

export type CapacityInfo = { text: string; tone: "muted" | "gold" | "amber" } | null;

/** "12 spots left", "Only 3 spots left", "Full · waitlist open" or "18 going". */
export function capacityInfo(
  capacity: number | null,
  counts: EventCounts | null | undefined,
  rsvpOpen: boolean,
): CapacityInfo {
  const taken = counts?.seatsTaken ?? 0;
  if (capacity == null) return taken > 0 ? { text: `${taken} going`, tone: "muted" } : null;
  const left = capacity - taken;
  if (left <= 0) return { text: rsvpOpen ? "Full · waitlist open" : "Full", tone: "amber" };
  if (left <= 5) return { text: `Only ${plural(left, "spot")} left`, tone: "gold" };
  return { text: `${plural(left, "spot")} left`, tone: "muted" };
}

/** Plain-words explanation of who needs organizer approval. */
export function approvalNote(mode: ApprovalMode, isMember: boolean, maxGuests: number): string | null {
  if (mode === "all_need_approval") {
    return "An organizer confirms each RSVP for this event. You'll get a notification once you're confirmed.";
  }
  if (mode === "guests_need_approval") {
    if (!isMember) {
      return "Community guests are confirmed by an organizer. You'll get a notification once you're in.";
    }
    if (maxGuests > 0) return "Guests you bring are confirmed by an organizer.";
  }
  return null;
}

const datePart = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: SITE_TIME_ZONE, ...options });
const weekdayFmt = datePart({ weekday: "short" });
const dayFmt = datePart({ day: "numeric" });
const monthFmt = datePart({ month: "short" });

/** Parts for the calendar-style date block: { weekday: "Fri", day: "23", month: "Oct" }. */
export function dateBlockParts(iso: string) {
  const d = new Date(iso);
  return { weekday: weekdayFmt.format(d), day: dayFmt.format(d), month: monthFmt.format(d) };
}

/** Google Maps search link for an address. */
export const mapsUrl = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/** Digits and + only, for tel: links. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, "")}`;

/** Split free text into paragraphs (blank-line separated). */
export const paragraphs = (text: string | null | undefined) =>
  (text ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
