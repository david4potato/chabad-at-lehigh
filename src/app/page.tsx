import Link from "next/link";
import { ArrowRight, Clock, Flame, MapPin, Phone, Salad, Mail, Navigation } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { safeNextPath } from "@/lib/safe-redirect";
import { formatLongDate, formatTimeRange, relativeDay } from "@/lib/time";
import {
  getEventsMeta,
  getNextShabbatDinner,
  getUrgentNotifications,
  listAnnouncements,
  listUpcomingEvents,
} from "@/lib/data/events";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { RsvpPanel } from "@/components/events/rsvp-panel";
import { EventCard } from "@/components/events/event-card";
import { AnnouncementList } from "@/components/events/announcement-list";
import { telHref } from "@/components/events/event-utils";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const [viewer, shabbat, upcoming, announcements, org] = await Promise.all([
    getViewer(),
    getNextShabbatDinner(),
    listUpcomingEvents({ limit: 5 }),
    listAnnouncements(3),
    getOrgSettings(),
  ]);
  const others = upcoming.filter((e) => e.id !== shabbat?.id).slice(0, 4);
  const [{ counts, rsvps }, urgent] = await Promise.all([
    getEventsMeta([...(shabbat ? [shabbat.id] : []), ...others.map((e) => e.id)], viewer?.id),
    viewer ? getUrgentNotifications(viewer.id) : Promise.resolve([]),
  ]);
  const isMember = viewer ? viewer.roles.some((r) => r !== "community_guest") : false;
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" }).format(new Date()));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8">
      {params.denied ? (
        <Alert tone="warning">That page is only for organizers. If you think you should have access, ask an admin.</Alert>
      ) : null}

      <div>
        <p className="text-sm font-semibold text-gold-700">Chabad at Lehigh</p>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
          {viewer ? `${greeting}, ${viewer.displayName}!` : "Welcome home."}
        </h1>
        {!viewer ? (
          <p className="mt-1.5 max-w-xl text-base text-muted">
            Shabbat dinners, learning and community for Lehigh students and friends. Everyone is welcome.
          </p>
        ) : null}
      </div>

      {urgent.length > 0 ? (
        <Alert tone="warning" title={urgent.length === 1 ? "Important update" : "Important updates"}>
          <ul className="space-y-1">
            {urgent.map((n) => (
              <li key={n.id}>
                {n.link ? (
                  <Link href={safeNextPath(n.link)} className="font-semibold underline underline-offset-2">
                    {n.title}
                  </Link>
                ) : (
                  <span className="font-semibold">{n.title}</span>
                )}
                {n.body ? <span className="block">{n.body}</span> : null}
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <section aria-labelledby="shabbat-heading">
        {shabbat ? (
          <div className="overflow-hidden rounded-[var(--radius-card)] border border-gold-200 bg-white shadow-sm">
            <div className="bg-gradient-to-br from-gold-100 via-gold-50 to-white px-5 py-5 sm:px-7 sm:py-6">
              <p className="flex items-center gap-2 text-sm font-bold text-gold-800">
                <Flame className="size-4" aria-hidden="true" />
                {relativeDay(shabbat.starts_at) ?? "Shabbat dinner"}
              </p>
              <h2 id="shabbat-heading" className="mt-1 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                {shabbat.title}
              </h2>
              <ul className="mt-3 space-y-1 text-base text-ink">
                <li className="flex items-center gap-2">
                  <Clock className="size-4 shrink-0 text-gold-700" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">{formatLongDate(shabbat.starts_at)}</span> ·{" "}
                    {formatTimeRange(shabbat.starts_at, shabbat.ends_at)}
                  </span>
                </li>
                {shabbat.location_name ? (
                  <li className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0 text-gold-700" aria-hidden="true" />
                    {shabbat.location_name}
                  </li>
                ) : null}
              </ul>
            </div>
            <div className="grid gap-5 px-5 py-5 sm:px-7 md:grid-cols-[1fr_auto] md:items-end">
              <div className="max-w-md">
                <RsvpPanel
                  event={shabbat}
                  counts={counts.get(shabbat.id) ?? null}
                  rsvp={rsvps.get(shabbat.id) ?? null}
                  signedIn={Boolean(viewer)}
                  isMember={isMember}
                />
              </div>
              <div className="flex flex-col gap-1 text-sm md:items-end">
                {shabbat.has_meal ? (
                  <Link href={`/events/${shabbat.slug}#menu`} className="inline-flex min-h-11 items-center gap-2 font-semibold text-brand-700 hover:underline">
                    <Salad className="size-4" aria-hidden="true" /> Menu &amp; allergens
                  </Link>
                ) : null}
                <Link href={`/events/${shabbat.slug}`} className="inline-flex min-h-11 items-center gap-1 font-semibold text-brand-700 hover:underline">
                  Event details <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <>
            <h2 id="shabbat-heading" className="sr-only">
              Shabbat dinner
            </h2>
            <EmptyState title="The next Shabbat dinner will be posted soon">
              Check back later this week, or browse other events below.
            </EmptyState>
          </>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="upcoming-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="upcoming-heading" className="text-lg font-bold text-ink">
              Coming up
            </h2>
            <Link href="/events" className="text-sm font-semibold text-brand-700 hover:underline">
              All events
            </Link>
          </div>
          {others.length === 0 ? (
            <EmptyState title="No other events this week" />
          ) : (
            <div className="space-y-3">
              {others.map((e) => (
                <EventCard key={e.id} event={e} counts={counts.get(e.id)} rsvp={rsvps.get(e.id)} />
              ))}
            </div>
          )}
        </section>

        <div className="space-y-8">
          <section aria-labelledby="news-heading">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="news-heading" className="text-lg font-bold text-ink">
                Announcements
              </h2>
              <Link href="/announcements" className="text-sm font-semibold text-brand-700 hover:underline">
                See all
              </Link>
            </div>
            {announcements.length === 0 ? (
              <p className="text-sm text-muted">No announcements right now.</p>
            ) : (
              <AnnouncementList items={announcements} compact />
            )}
          </section>

          <section aria-labelledby="quick-heading">
            <h2 id="quick-heading" className="mb-3 text-lg font-bold text-ink">
              Quick links
            </h2>
            <Card className="p-2 sm:p-2">
              <ul className="divide-y divide-stone-100">
                <QuickLink href="/find-us" Icon={Navigation} label="Find us & directions" />
                <QuickLink href="/meal-safety" Icon={Salad} label="Meals & allergies" />
                {org.contact_email ? (
                  <QuickLink href={`mailto:${org.contact_email}`} Icon={Mail} label="Email the organizer" external />
                ) : null}
                {org.contact_phone ? (
                  <QuickLink href={telHref(org.contact_phone)} Icon={Phone} label="Call or text the organizer" external />
                ) : null}
              </ul>
            </Card>
          </section>

          {!viewer ? (
            <p className="text-sm text-muted">
              <Link href="/sign-in" className="font-semibold text-brand-700 hover:underline">
                Sign in
              </Link>{" "}
              to RSVP, save your dietary needs privately, and see your events.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  Icon,
  label,
  external,
}: {
  href: string;
  Icon: typeof Mail;
  label: string;
  external?: boolean;
}) {
  const className = "flex min-h-12 items-center gap-3 rounded-xl px-3 font-semibold text-ink hover:bg-stone-50";
  const content = (
    <>
      <Icon className="size-5 text-brand-700" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="size-4 text-muted" aria-hidden="true" />
    </>
  );
  return (
    <li>
      {external ? (
        <a href={href} className={className}>
          {content}
        </a>
      ) : (
        <Link href={href} className={className}>
          {content}
        </Link>
      )}
    </li>
  );
}
