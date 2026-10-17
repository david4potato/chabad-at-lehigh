import Link from "next/link";
import { MapPin } from "lucide-react";
import { formatLongDate, formatTimeRange, relativeDay } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import type { EventCounts, EventSummary, MyRsvp } from "@/lib/data/events";
import { CATEGORY_LABELS, RSVP_BADGES, capacityInfo, dateBlockParts, rsvpClosedReason } from "./event-utils";

export function DateBlock({ iso, className }: { iso: string; className?: string }) {
  const { weekday, day, month } = dateBlockParts(iso);
  return (
    <div
      className={cn(
        "flex w-14 shrink-0 flex-col items-center justify-center rounded-2xl border border-gold-200 bg-gold-50 py-2 text-center",
        className,
      )}
      aria-hidden="true"
    >
      <span className="text-[11px] font-bold uppercase tracking-wide text-gold-800">{weekday}</span>
      <span className="text-2xl font-extrabold leading-none text-ink">{day}</span>
      <span className="text-[11px] font-semibold text-muted">{month}</span>
    </div>
  );
}

/** Compact, tappable event row used on Home, Events and My Events. */
export function EventCard({
  event,
  counts,
  rsvp,
}: {
  event: EventSummary;
  counts?: EventCounts | null;
  rsvp?: MyRsvp | null;
}) {
  const closed = rsvpClosedReason(event);
  const capacity = event.status === "cancelled" ? null : capacityInfo(event.capacity, counts, !closed);
  const when = relativeDay(event.starts_at);
  const badge = rsvp ? RSVP_BADGES[rsvp.status] : null;

  return (
    <Link
      href={`/events/${event.slug}`}
      className="group flex gap-4 rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm transition hover:border-brand-200 hover:shadow-md"
    >
      <DateBlock iso={event.starts_at} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-muted">{CATEGORY_LABELS[event.category]}</span>
          {event.status === "cancelled" ? <Badge tone="red">Cancelled</Badge> : null}
          {badge && event.status !== "cancelled" ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
        </div>
        <h3 className="text-base font-bold leading-snug text-ink group-hover:text-brand-800">{event.title}</h3>
        <p className="text-sm text-muted">
          {/* The date block is hidden from screen readers, so say the date here. */}
          <span className="sr-only">{formatLongDate(event.starts_at)}, </span>
          {when ? <span className="font-semibold text-ink">{when} · </span> : null}
          {formatTimeRange(event.starts_at, event.ends_at)}
        </p>
        {event.location_name ? (
          <p className="flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{event.location_name}</span>
          </p>
        ) : null}
        {capacity ? (
          <p
            className={cn(
              "text-xs font-semibold",
              capacity.tone === "amber" ? "text-amber-800" : capacity.tone === "gold" ? "text-gold-700" : "text-muted",
            )}
          >
            {capacity.text}
          </p>
        ) : null}
      </div>
    </Link>
  );
}
