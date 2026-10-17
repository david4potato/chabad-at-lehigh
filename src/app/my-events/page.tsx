import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getEventCounts, getMyEvents } from "@/lib/data/events";
import { parseMyStats } from "@/lib/stats";
import { formatShortDateMaybeYear } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { FilterChips } from "@/components/events/filter-chips";
import { CATEGORY_FILTERS, isEventCategory } from "@/components/events/event-utils";

export const metadata: Metadata = { title: "My Events" };

// "Other" stays under All to keep the row short.
const PAST_FILTERS = CATEGORY_FILTERS.filter((c) => c.value !== "other");

export default async function MyEventsPage({ searchParams }: PageProps<"/my-events">) {
  const viewer = await requireViewer("/my-events");
  const params = await searchParams;
  const pastCategory = isEventCategory(params.past) ? params.past : undefined;
  const supabase = await createClient();
  const [{ upcoming, notGoing, past, pastTotal }, myStats] = await Promise.all([
    getMyEvents(viewer.id, { pastCategory }),
    supabase.rpc("get_my_stats"),
  ]);
  const counts = await getEventCounts(upcoming.map((e) => e.event_id));
  // "Last time" uses the same attendance rule as the Profile (check-in counts
  // when organizers used it). If the numbers fail to load, the line is left out.
  const lastAttended = myStats.error ? null : parseMyStats(myStats.data).last;

  // Chips and "Show all" jump back to this section, not the top of the page.
  const pastChips = [
    { label: "All", href: "/my-events#past-heading", active: !pastCategory },
    ...PAST_FILTERS.map((c) => ({
      label: c.label,
      href: `/my-events?past=${c.value}#past-heading`,
      active: pastCategory === c.value,
    })),
  ];
  const pastLabel = CATEGORY_FILTERS.find((c) => c.value === pastCategory)?.label;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        title="My Events"
        description="Everything you've RSVP'd to. Tap an event to see details or change your RSVP."
        actions={<ButtonLink href="/events" variant="secondary">Browse events</ButtonLink>}
      />

      <section aria-labelledby="upcoming-heading">
        <h2 id="upcoming-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming RSVPs yet" action={<ButtonLink href="/events">Find an event</ButtonLink>}>
            When you RSVP to an event, it will show up here.
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {upcoming.map((entry) => (
              <EventCard key={entry.event_id} event={entry.event} counts={counts.get(entry.event_id)} rsvp={entry} />
            ))}
          </div>
        )}
      </section>

      {notGoing.length > 0 ? (
        <details className="group">
          <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-muted hover:text-ink">
            Not going ({notGoing.length})
          </summary>
          <div className="mt-3 space-y-3">
            {notGoing.map((entry) => (
              <EventCard key={entry.event_id} event={entry.event} rsvp={entry} />
            ))}
          </div>
        </details>
      ) : null}

      {pastTotal > 0 ? (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="scroll-mt-24 text-sm font-bold uppercase tracking-wide text-muted">
            Past events
          </h2>
          {lastAttended ? (
            <p className="mt-1 text-sm text-muted">
              Last time:{" "}
              <Link href={`/events/${lastAttended.slug}`} className="font-semibold text-brand-700 hover:underline">
                {lastAttended.title}
              </Link>{" "}
              · {formatShortDateMaybeYear(lastAttended.startsAt)}
            </p>
          ) : null}

          <FilterChips label="Filter past events" items={pastChips} className="mt-3 mb-4" />

          {past.length === 0 ? (
            <EmptyState
              title={pastLabel ? `Nothing under ${pastLabel} yet` : "Nothing here yet"}
              action={<ButtonLink href="/my-events#past-heading" variant="secondary">Show all</ButtonLink>}
            />
          ) : (
            <div className="space-y-3">
              {past.map((entry) => (
                <EventCard key={entry.event_id} event={entry.event} />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
