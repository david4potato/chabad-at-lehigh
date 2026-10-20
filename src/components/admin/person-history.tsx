import type { ReactNode } from "react";
import Link from "next/link";
import { formatDateTime, formatShortDateMaybeYear } from "@/lib/time";
import { formatSince } from "@/lib/stats";
import { RSVP_STATUS_LABEL } from "@/lib/rsvp-labels";
import type { EventCategory } from "@/lib/data/events";
import { CATEGORY_LABELS, isEventCategory, plural, type BadgeTone } from "@/components/events/event-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";

// One person's history for admins (Dashboard → People & roles → a person).
// The SQL in get_person_history() does the counting; this file reads the JSON
// safely and shows it. No dietary data here, ever.

type UpcomingStatus = "going" | "waitlist" | "pending";

export type PersonHistory = {
  events: number;
  shabbatDinners: number;
  helped: number;
  /** First event attended (UTC ISO), or null. */
  since: string | null;
  /** Latest event attended (UTC ISO), or null. */
  lastAt: string | null;
  recent: { title: string; slug: string; startsAt: string; category: EventCategory }[];
  upcoming: { title: string; slug: string; startsAt: string; status: UpcomingStatus }[];
  shifts: { title: string; startsAt: string }[];
};

const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const asArray = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.map(asObject) : []);

const count = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
};

const text = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

const UPCOMING_STATUSES: readonly UpcomingStatus[] = ["going", "waitlist", "pending"];
const isUpcomingStatus = (v: unknown): v is UpcomingStatus =>
  typeof v === "string" && (UPCOMING_STATUSES as readonly string[]).includes(v);

/** Read the jsonb from get_person_history(). Anything missing or odd becomes 0, null or is skipped. */
export function parsePersonHistory(data: unknown): PersonHistory {
  const o = asObject(data);
  return {
    events: count(o.events),
    shabbatDinners: count(o.shabbat_dinners),
    helped: count(o.helped),
    since: text(o.since),
    lastAt: text(o.last_at),
    recent: asArray(o.recent).flatMap((r) => {
      const title = text(r.title);
      const slug = text(r.slug);
      const startsAt = text(r.starts_at);
      if (!title || !slug || !startsAt) return [];
      return [{ title, slug, startsAt, category: isEventCategory(r.category) ? r.category : "other" }];
    }),
    upcoming: asArray(o.upcoming).flatMap((r) => {
      const title = text(r.title);
      const slug = text(r.slug);
      const startsAt = text(r.starts_at);
      if (!title || !slug || !startsAt || !isUpcomingStatus(r.status)) return [];
      return [{ title, slug, startsAt, status: r.status }];
    }),
    shifts: asArray(o.shifts).flatMap((r) => {
      const title = text(r.title);
      const startsAt = text(r.starts_at);
      return title && startsAt ? [{ title, startsAt }] : [];
    }),
  };
}

/** The short muted line in the People list: "Came 8 times · last Sat, Oct 10" (with the year when it isn't this year). */
export function activityLine(events: number, lastAt: string | null): string {
  if (events <= 0) return "Hasn't come to an event yet";
  const came = `Came ${plural(events, "time")}`;
  return lastAt ? `${came} · last ${formatShortDateMaybeYear(lastAt)}` : came;
}

const STATUS_TONE: Record<UpcomingStatus, BadgeTone> = { going: "green", waitlist: "amber", pending: "brand" };

const isUpcoming = (iso: string) => new Date(iso).getTime() > Date.now();

const linkClass = "inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline";

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <Card role="region" aria-labelledby={id}>
      <CardTitle id={id}>{title}</CardTitle>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="mt-2 text-sm text-muted">{children}</p>;
}

/** Activity numbers, then Recent events, Upcoming RSVPs and Volunteer shifts. */
export function PersonHistoryView({ history }: { history: PersonHistory }) {
  const tiles = [
    { label: "Events", value: history.events },
    { label: "Shabbat dinners", value: history.shabbatDinners },
    { label: "Times helped", value: history.helped },
  ];

  return (
    <>
      <Section id="person-activity" title="Activity">
        <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col-reverse justify-end rounded-xl bg-cream px-2 py-3 text-center sm:px-3">
              <dt className="text-sm font-medium text-muted sm:text-sm">{t.label}</dt>
              <dd className="text-2xl font-extrabold text-ink">{t.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 space-y-1 text-sm text-muted">
          {history.since ? <p>Coming since {formatSince(history.since)}</p> : null}
          {history.lastAt ? <p>Last time: {formatShortDateMaybeYear(history.lastAt)}</p> : null}
          {!history.since && !history.lastAt ? <p>Hasn&apos;t come to an event yet.</p> : null}
        </div>
      </Section>

      <Section id="person-recent" title="Recent events">
        {history.recent.length === 0 ? (
          <Empty>Events they come to will show up here.</Empty>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100">
            {history.recent.map((e) => (
              <li key={`${e.slug}-${e.startsAt}`} className="flex flex-wrap items-center justify-between gap-x-3 py-1">
                <Link href={`/events/${e.slug}`} className={linkClass}>
                  {e.title}
                </Link>
                <span className="pb-2 text-sm text-muted sm:pb-0">
                  {formatShortDateMaybeYear(e.startsAt)} · {CATEGORY_LABELS[e.category]}
                </span>
              </li>
            ))}
          </ul>
        )}
        {history.recent.length > 0 && history.events > history.recent.length ? (
          <p className="mt-2 text-sm text-muted">Showing the latest {history.recent.length}.</p>
        ) : null}
      </Section>

      <Section id="person-upcoming" title="Upcoming RSVPs">
        {history.upcoming.length === 0 ? (
          <Empty>No upcoming RSVPs.</Empty>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100">
            {history.upcoming.map((e) => (
              <li key={`${e.slug}-${e.startsAt}`} className="flex flex-wrap items-center justify-between gap-x-3 py-1">
                <Link href={`/events/${e.slug}`} className={linkClass}>
                  {e.title}
                </Link>
                <span className="flex flex-wrap items-center gap-2 pb-2 text-sm text-muted sm:pb-0">
                  {formatDateTime(e.startsAt)}
                  <Badge tone={STATUS_TONE[e.status]}>{RSVP_STATUS_LABEL[e.status]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="person-shifts" title="Volunteer shifts">
        {history.shifts.length === 0 ? (
          <Empty>Hasn&apos;t signed up to help yet.</Empty>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100">
            {history.shifts.map((s, i) => (
              <li key={`${i}-${s.startsAt}`} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-3">
                <span className="font-semibold text-ink">{s.title}</span>
                <span className="flex flex-wrap items-center gap-2 text-sm text-muted">
                  {formatDateTime(s.startsAt)}
                  {isUpcoming(s.startsAt) ? <Badge tone="brand">Coming up</Badge> : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </>
  );
}
