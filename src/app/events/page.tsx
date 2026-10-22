import type { Metadata } from "next";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { CalendarDays, ChevronLeft, ChevronRight, List } from "lucide-react";
import { getViewer } from "@/lib/auth";
import {
  getEventsMeta,
  listEventsBetween,
  listPastEvents,
  listUpcomingEvents,
  type EventCategory,
  type EventSummary,
} from "@/lib/data/events";
import {
  addMonths,
  clampMonth,
  currentMonth,
  groupByDay,
  monthGrid,
  monthKey,
  monthRange,
  monthsBetween,
  nextEventDay,
  parseDay,
  parseMonth,
  pickSelectedDay,
  type YearMonth,
} from "@/lib/calendar";
import { formatDayKey, formatMonthShort, formatMonthYear, siteDateKey } from "@/lib/time";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EventCard } from "@/components/events/event-card";
import { MonthCalendar } from "@/components/events/month-calendar";
import { CalendarSubscribe } from "@/components/events/calendar-subscribe";
import { FilterChips } from "@/components/events/filter-chips";
import { CATEGORY_FILTERS, isEventCategory } from "@/components/events/event-utils";

export const metadata: Metadata = { title: "Events" };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// How far the month view can page back and ahead of the current month.
const MONTHS_BACK = 24;
const MONTHS_AHEAD = 12;

type EventsQuery = { view?: "month"; month?: string; day?: string; category?: EventCategory; when?: "past" };

/** An /events URL with its query keys in a stable order. */
function eventsHref(q: EventsQuery) {
  const params = new URLSearchParams();
  if (q.view) params.set("view", q.view);
  if (q.month) params.set("month", q.month);
  if (q.day) params.set("day", q.day);
  if (q.category) params.set("category", q.category);
  if (q.when) params.set("when", q.when);
  const s = params.toString();
  return s ? `/events?${s}` : "/events";
}

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
  const isMonth = params.view === "month";
  const past = !isMonth && params.when === "past";

  // Chips keep the current view (and the month and day in month view).
  const keep: EventsQuery = isMonth
    ? {
        view: "month",
        month: parseMonth(params.month) ? String(params.month) : undefined,
        day: typeof params.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.day) ? params.day : undefined,
      }
    : { when: past ? "past" : undefined };
  const chips = [
    { label: "All", href: eventsHref(keep), active: !category },
    ...CATEGORY_FILTERS.map((c) => ({ label: c.label, href: eventsHref({ ...keep, category: c.value }), active: category === c.value })),
  ];

  return (
    <div>
      <PageHeader
        title={past ? "Past events" : "Events"}
        description={past ? "A look back at recent events." : "Shabbat dinners, learning, holidays and more. Everyone is welcome."}
        actions={<ViewSwitch month={isMonth} category={category} />}
      />

      <FilterChips label="Filter by category" items={chips} className="mb-6" />

      {isMonth ? (
        <MonthView category={category} monthParam={params.month} dayParam={params.day} />
      ) : (
        <ListView category={category} past={past} />
      )}

      <CalendarSubscribe />
    </div>
  );
}

function ViewSwitch({ month, category }: { month: boolean; category?: EventCategory }) {
  const item = (active: boolean, href: string, Icon: LucideIcon, label: string) => (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors",
        active ? "bg-brand-700 text-white" : "text-ink hover:bg-stone-100",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </Link>
  );
  return (
    <nav aria-label="Calendar view" className="inline-flex rounded-xl border border-stone-300 bg-white p-1">
      {item(!month, eventsHref({ category }), List, "List")}
      {item(month, eventsHref({ view: "month", category }), CalendarDays, "Month")}
    </nav>
  );
}

async function ListView({ category, past }: { category?: EventCategory; past: boolean }) {
  const [viewer, events] = await Promise.all([
    getViewer(),
    past ? listPastEvents({ category }) : listUpcomingEvents({ category }),
  ]);
  const { counts, rsvps } = await getEventsMeta(
    events.map((e) => e.id),
    viewer?.id,
  );

  const groups = past ? [{ key: "past", title: "Past events", items: events }] : groupUpcoming(events);

  return (
    <>
      {events.length === 0 ? (
        <EmptyState
          title={past ? "No past events to show" : "No upcoming events right now"}
          action={
            category ? (
              <ButtonLink href={eventsHref({ when: past ? "past" : undefined })} variant="secondary">
                Show all events
              </ButtonLink>
            ) : undefined
          }
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

      <p className="mt-12 text-center text-sm">
        <Link
          href={eventsHref({ category, when: past ? undefined : "past" })}
          prefetch={false}
          className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline"
        >
          {past ? "← Back to upcoming events" : "See past events"}
        </Link>
      </p>
    </>
  );
}

async function MonthView({
  category,
  monthParam,
  dayParam,
}: {
  category?: EventCategory;
  monthParam: unknown;
  dayParam: unknown;
}) {
  const now = new Date();
  const thisMonth = currentMonth(now);
  const ym = clampMonth(parseMonth(monthParam) ?? thisMonth, thisMonth, MONTHS_BACK, MONTHS_AHEAD);
  const offset = monthsBetween(thisMonth, ym);

  const [viewer, events] = await Promise.all([getViewer(), listEventsBetween({ ...monthRange(ym), category })]);
  // Multi-day events are listed on each of their days in this month.
  const byDay = groupByDay(events, ym);
  const anyCancelled = [...byDay.values()].some((list) => list.some((e) => e.status === "cancelled"));
  const today = siteDateKey(now);
  const selected = pickSelectedDay(ym, parseDay(dayParam, ym), today, byDay.keys());
  const dayEvents = selected ? (byDay.get(selected) ?? []) : [];
  const { counts, rsvps } = await getEventsMeta(
    dayEvents.map((e) => e.id),
    viewer?.id,
  );

  const hrefFor = (target: YearMonth, day?: string) =>
    eventsHref({ view: "month", month: monthKey(target), day, category });
  const prev = offset > -MONTHS_BACK ? addMonths(ym, -1) : null;
  const next = offset < MONTHS_AHEAD ? addMonths(ym, 1) : null;
  const following = selected ? nextEventDay(selected, byDay.keys()) : null;
  const monthLabel = formatMonthYear(ym.year, ym.month);
  const categoryLabel = CATEGORY_FILTERS.find((c) => c.value === category)?.label;
  const navClass = buttonClasses("secondary", "md", "px-3 text-sm");

  return (
    <>
      <section aria-labelledby="month-heading">
        <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="justify-self-start">
            {prev ? (
              <Link href={hrefFor(prev)} prefetch={false} className={navClass}>
                <ChevronLeft className="size-4" aria-hidden="true" />
                <span className="sr-only">Previous month: </span>
                {formatMonthShort(prev.year, prev.month)}
              </Link>
            ) : null}
          </div>
          <h2 id="month-heading" className="text-center text-lg font-extrabold text-ink sm:text-xl">
            {monthLabel}
          </h2>
          <div className="justify-self-end">
            {next ? (
              <Link href={hrefFor(next)} prefetch={false} className={navClass}>
                <span className="sr-only">Next month: </span>
                {formatMonthShort(next.year, next.month)}
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>

        <MonthCalendar
          weeks={monthGrid(ym)}
          eventsByDay={byDay}
          today={today}
          selected={selected}
          dayHref={(day) => `${hrefFor(ym, day)}#day-events`}
          labelledBy="month-heading"
        />

        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 text-sm text-muted">
          {anyCancelled ? (
            <p className="flex min-h-11 items-center gap-2 md:hidden">
              <span className="inline-block size-1.5 rounded-full border border-stone-500" aria-hidden="true" />
              Hollow dot: cancelled
            </p>
          ) : null}
          {offset !== 0 ? (
            <Link
              href={eventsHref({ view: "month", category })}
              prefetch={false}
              className="ml-auto inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline"
            >
              Back to this month
            </Link>
          ) : null}
        </div>
      </section>

      {byDay.size === 0 || !selected ? (
        <div className="mt-6">
          <EmptyState
            title={categoryLabel ? `Nothing under ${categoryLabel} in ${monthLabel}` : `No events in ${monthLabel}`}
            action={
              category ? (
                <ButtonLink href={eventsHref({ view: "month", month: monthKey(ym) })} variant="secondary" prefetch={false}>
                  Show all events
                </ButtonLink>
              ) : undefined
            }
          >
            {offset >= 0 && !category ? "Check back soon — new events are added every week." : null}
          </EmptyState>
        </div>
      ) : (
        <section id="day-events" aria-labelledby="day-heading" className="mt-6 scroll-mt-24">
          <h2 id="day-heading" className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
            {selected === today ? `Today · ${formatDayKey(selected)}` : formatDayKey(selected)}
          </h2>
          {dayEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {dayEvents.map((e) => (
                <EventCard key={e.id} event={e} counts={counts.get(e.id)} rsvp={rsvps.get(e.id)} />
              ))}
            </div>
          ) : (
            <p className="rounded-[var(--radius-card)] border border-dashed border-stone-300 bg-white/60 px-4 py-6 text-sm text-muted max-w-none">
              Nothing on this day.
              {following ? (
                <>
                  {" "}
                  <Link
                    href={`${hrefFor(ym, following)}#day-events`}
                    prefetch={false}
                    className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline"
                  >
                    Next: {formatDayKey(following)}
                  </Link>
                </>
              ) : null}
            </p>
          )}
        </section>
      )}
    </>
  );
}
