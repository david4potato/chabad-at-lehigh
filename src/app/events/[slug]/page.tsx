import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Clock, MapPin } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { formatLongDate, formatTimeRange } from "@/lib/time";
import { getEventBySlug, getEventsMeta, getMyMealPreference } from "@/lib/data/events";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { RsvpPanel } from "@/components/events/rsvp-panel";
import { MealPreferenceForm } from "@/components/events/meal-preference-form";
import { ContactCard } from "@/components/events/contact-card";
import { ShareButton } from "@/components/events/share-button";
import { CATEGORY_LABELS, mapsUrl, paragraphs, rsvpClosedReason } from "@/components/events/event-utils";
import { EventMenuSection } from "@/components/menu/event-menu-section";

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug);
  return event ? { title: event.title, description: event.summary ?? undefined } : { title: "Event not found" };
}

export default async function EventPage({ params, searchParams }: PageProps<"/events/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [event, viewer] = await Promise.all([getEventBySlug(slug), getViewer()]);
  if (!event) notFound();

  const [{ counts, rsvps }, mealPref] = await Promise.all([
    getEventsMeta([event.id], viewer?.id),
    viewer && event.has_meal ? getMyMealPreference(event.id, viewer.id) : Promise.resolve(null),
  ]);
  const rsvp = rsvps.get(event.id) ?? null;
  const intent = query.rsvp === "going" || query.rsvp === "not_going" ? query.rsvp : null;
  const isMember = viewer ? viewer.roles.some((r) => r !== "community_guest") : false;
  const showMealForm = Boolean(viewer && event.has_meal && !rsvpClosedReason(event) && rsvp && rsvp.status !== "not_going");

  return (
    <article className="space-y-6">
      {event.status === "draft" && viewer && isStaff(viewer.roles) ? (
        <Alert tone="warning" title="Draft">
          Only staff can see this event until it&apos;s published.
        </Alert>
      ) : null}
      {event.status === "cancelled" ? (
        <Alert tone="warning" title="This event has been cancelled">
          We&apos;re sorry for any inconvenience. Please contact the organizer with questions.
        </Alert>
      ) : null}

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="gold">{CATEGORY_LABELS[event.category]}</Badge>
          {event.visibility === "members" ? <Badge>Members only</Badge> : null}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">{event.title}</h1>
        {event.summary ? <p className="max-w-2xl text-lg text-muted">{event.summary}</p> : null}
        <ul className="space-y-1.5 text-base text-ink">
          <li className="flex items-start gap-2">
            <Clock className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>
              <span className="font-semibold">{formatLongDate(event.starts_at)}</span> ·{" "}
              {formatTimeRange(event.starts_at, event.ends_at)}
            </span>
          </li>
          {event.location_name || event.location_address ? (
            <li className="flex items-start gap-2">
              <MapPin className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                {event.location_name}
                {event.location_address ? (
                  <>
                    {event.location_name ? " · " : null}
                    <a
                      href={mapsUrl(event.location_address)}
                      className="font-medium text-brand-700 hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {event.location_address}
                    </a>
                  </>
                ) : null}
              </span>
            </li>
          ) : null}
        </ul>
        {event.status === "published" ? (
          <div className="flex flex-wrap gap-x-6">
            <a
              href={`/events/${event.slug}/calendar.ics`}
              className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 hover:underline"
            >
              <CalendarPlus className="size-4" aria-hidden="true" /> Add to calendar
            </a>
            <ShareButton title={event.title} path={`/events/${event.slug}`} />
          </div>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
        <div className="order-2 space-y-6 lg:order-1">
          {event.description ? (
            <Card>
              <CardTitle>About this event</CardTitle>
              <div className="prose-simple mt-2 text-base leading-relaxed text-ink">
                {paragraphs(event.description).map((p, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {p}
                  </p>
                ))}
              </div>
            </Card>
          ) : null}
          <EventMenuSection event={event} viewer={viewer} />
          <div className="lg:hidden">
            <ContactCard contact={{ name: event.contact_name, email: event.contact_email, phone: event.contact_phone }} />
          </div>
        </div>

        <aside className="order-1 space-y-6 lg:sticky lg:top-24 lg:order-2">
          <Card className="border-gold-200">
            <CardTitle>RSVP</CardTitle>
            <div className="mt-3">
              <RsvpPanel
                event={event}
                counts={counts.get(event.id) ?? null}
                rsvp={rsvp}
                signedIn={Boolean(viewer)}
                isMember={isMember}
                intent={intent}
              />
            </div>
          </Card>
          {showMealForm ? (
            <Card>
              <CardTitle>Meal notes for this event</CardTitle>
              <div className="mt-3">
                <MealPreferenceForm
                  eventId={event.id}
                  slug={event.slug}
                  initial={mealPref}
                  allowsGuests={event.max_guests_per_rsvp > 0}
                />
              </div>
            </Card>
          ) : null}
          <div className="hidden lg:block">
            <ContactCard contact={{ name: event.contact_name, email: event.contact_email, phone: event.contact_phone }} />
          </div>
          <p className="hidden text-center text-sm lg:block">
            <Link href="/events" className="font-semibold text-brand-700 hover:underline">
              ← All events
            </Link>
          </p>
        </aside>
      </div>
    </article>
  );
}
