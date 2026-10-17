import type { Metadata } from "next";
import Link from "next/link";
import { getViewer } from "@/lib/auth";
import { getEventsMeta, listPastEvents, listUpcomingEvents, type EventSummary } from "@/lib/data/events";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { CATEGORY_FILTERS, isEventCategory } from "@/components/events/event-utils";

export const metadata: Metadata = { title: "Events" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Split upcoming events into "This week" and "Coming up". */
function groupUpcoming(events: EventSummary[], now = Date.now()) {
  return [
    { key: "this-week", title: "This week", items: events.filter((e) => new Date(e.starts_at).getTime() - now < WEEK_MS) },
    { key: "coming-up", title: "Coming up", items: events.filter((e) => new Date(e.starts_at).getTime() - now >= WEEK_MS) },
  ];
}

export default async function EventsPage({ searchParams }: PageProps<"/events">) {
  const params = await searchParams;
  const category = isEventCategory(params.category) ? params.category : undefined;
  const past = params.when === "past";

  const [viewer, events] = await Promise.all([
    getViewer(),
    past ? listPastEvents({ category }) : listUpcomingEvents({ category }),
  ]);
  const { counts, rsvps } = await getEventsMeta(
    events.map((e) => e.id),
    viewer?.id,
  );

  const groups = past ? [{ key: "past", title: "Past events", items: events }] : groupUpcoming(events);

  const chipHref = (value?: string) => {
    const q = new URLSearchParams();
    if (value) q.set("category", value);
    if (past) q.set("when", "past");
    const s = q.toString();
    return s ? `/events?${s}` : "/events";
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
      active ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-ink hover:bg-stone-50",
    );

  return (
    <div>
      <PageHeader
        title={past ? "Past events" : "Events"}
        description={past ? "A look back at recent events." : "Shabbat dinners, learning, holidays and more. Everyone is welcome."}
      />

      <nav aria-label="Filter by category" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="flex w-max gap-2">
          <li>
            <Link href={chipHref()} prefetch={false} className={chip(!category)} aria-current={!category ? "page" : undefined}>
              All
            </Link>
          </li>
          {CATEGORY_FILTERS.map((c) => (
            <li key={c.value}>
              <Link
                href={chipHref(c.value)}
                prefetch={false}
                className={chip(category === c.value)}
                aria-current={category === c.value ? "page" : undefined}
              >
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {events.length === 0 ? (
        <EmptyState
          title={past ? "No past events to show" : "No upcoming events right now"}
          action={category ? <ButtonLink href={past ? "/events?when=past" : "/events"} variant="secondary">Show all events</ButtonLink> : undefined}
        >
          {past ? null : "Check back soon — new events are added every week."}
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.key} aria-labelledby={`group-${g.key}`}>
                <h2 id={`group-${g.key}`} className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
                  {g.title}
                </h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {g.items.map((e) => (
                    <EventCard key={e.id} event={e} counts={counts.get(e.id)} rsvp={rsvps.get(e.id)} />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      <p className="mt-10 text-center text-sm">
        <Link
          href={past ? "/events" : "/events?when=past"}
          prefetch={false}
          className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline"
        >
          {past ? "← Back to upcoming events" : "See past events"}
        </Link>
      </p>
    </div>
  );
}
