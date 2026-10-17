import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { getEventCounts, getMyEvents } from "@/lib/data/events";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";

export const metadata: Metadata = { title: "My Events" };

export default async function MyEventsPage() {
  const viewer = await requireViewer("/my-events");
  const { upcoming, notGoing, past } = await getMyEvents(viewer.id);
  const counts = await getEventCounts(upcoming.map((e) => e.event_id));

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

      {past.length > 0 ? (
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            Past events you attended
          </h2>
          <div className="space-y-3">
            {past.map((entry) => (
              <EventCard key={entry.event_id} event={entry.event} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
