import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarPlus, Clock, MapPin } from "lucide-react";
import { OG_IMAGE, SITE } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatEventWhen, formatLongDate, formatTimeRange, spansDays } from "@/lib/time";
import { getEventBySlug, getEventsMeta, getMyMealPreference } from "@/lib/data/events";
import { listOpenShifts } from "@/lib/data/volunteer";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { RsvpPanel } from "@/components/events/rsvp-panel";
import { MealPreferenceForm } from "@/components/events/meal-preference-form";
import { ContactCard } from "@/components/events/contact-card";
import { ShareButton } from "@/components/events/share-button";
import { CATEGORY_LABELS, mapsUrl, paragraphs, rsvpClosedReason } from "@/components/events/event-utils";
import { EventMenuSection } from "@/components/menu/event-menu-section";
import { EventHelpOut } from "@/components/volunteer/event-help-out";

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export async function generateMetadata({ params }: PageProps<"/events/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [event, viewer] = await Promise.all([getEventBySlug(slug), getViewer()]);
  // Signed out, a members-only event looks the same as a missing one, so keep the title neutral.
  if (!event) return { title: viewer ? "Event not found" : "Event", robots: { index: false } };

  // Link previews in group chats read these, so include the date, time and place.
  const title = event.status === "cancelled" ? `Cancelled: ${event.title}` : event.title;
  const when = [formatEventWhen(event.starts_at, event.ends_at), event.location_name].filter(Boolean).join(" · ");
  const description = [when, event.summary].filter(Boolean).join(". ");
  const url = `/events/${event.slug}`;
  return {
    title,
    description,
    alternates: { canonical: url },
    // A page-level openGraph replaces the layout's whole object, so siteName, type and the image are repeated.
    openGraph: { title, description, url, siteName: SITE.name, type: "website", images: [OG_IMAGE] },
    twitter: { card: "summary_large_image", title, description, images: [OG_IMAGE] },
  };
}

/** Members-only events are hidden from signed-out visitors, so offer sign-in instead of "not found". */
function SignInToView({ slug }: { slug: string }) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <h1 className="text-3xl font-extrabold tracking-tight lg:text-[2.5rem] lg:leading-tight">Sign in to see this event</h1>
      <p className="mt-2 text-muted">This event may be for signed-in members, or it may no longer be available.</p>
      <div className="mt-6 flex justify-center gap-2">
        <ButtonLink href={`/sign-in?next=${encodeURIComponent(`/events/${slug}`)}`}>Sign in</ButtonLink>
        <ButtonLink href="/events" variant="secondary">
          See events
        </ButtonLink>
      </div>
    </div>
  );
}

/** The viewer's own dietary profile setting (owner-readable under RLS). No profile yet means sharing is on. */
async function getShareWithKitchen(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.from("dietary_profiles").select("share_with_kitchen").eq("user_id", userId).maybeSingle();
  return data?.share_with_kitchen ?? true;
}

export default async function EventPage({ params, searchParams }: PageProps<"/events/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const [event, viewer] = await Promise.all([getEventBySlug(slug), getViewer()]);
  if (!event) {
    if (!viewer && SLUG_RE.test(slug) && slug.length <= 80) return <SignInToView slug={slug} />;
    notFound();
  }

  const [{ counts, rsvps }, mealPref, shareWithKitchen, shifts] = await Promise.all([
    getEventsMeta([event.id], viewer?.id),
    viewer && event.has_meal ? getMyMealPreference(event.id, viewer.id) : Promise.resolve(null),
    viewer && event.has_meal ? getShareWithKitchen(viewer.id) : Promise.resolve(true),
    event.status === "published" ? listOpenShifts({ eventId: event.id, viewerId: viewer?.id }) : Promise.resolve([]),
  ]);
  const rsvp = rsvps.get(event.id) ?? null;
  const intent = query.rsvp === "going" || query.rsvp === "not_going" ? query.rsvp : null;
  const isMember = viewer ? viewer.roles.some((r) => r !== "community_guest") : false;
  // Only active RSVPs: the kitchen's report leaves out declined and not-going ones.
  const showMealForm = Boolean(
    viewer &&
      event.has_meal &&
      !rsvpClosedReason(event) &&
      rsvp &&
      (rsvp.status === "going" || rsvp.status === "pending" || rsvp.status === "waitlist"),
  );

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
        <h1 className="text-3xl font-extrabold tracking-tight text-ink lg:text-[2.5rem] lg:leading-tight">{event.title}</h1>
        {event.summary ? <p className="max-w-2xl text-lg text-muted">{event.summary}</p> : null}
        <ul className="space-y-2 text-base text-ink">
          <li className="flex items-start gap-2">
            <Clock className="mt-1 size-4 shrink-0 text-muted" aria-hidden="true" />
            {spansDays(event.starts_at, event.ends_at) ? (
              <span className="font-semibold">{formatTimeRange(event.starts_at, event.ends_at)}</span>
            ) : (
              <span>
                <span className="font-semibold">{formatLongDate(event.starts_at)}</span> ·{" "}
                {formatTimeRange(event.starts_at, event.ends_at)}
              </span>
            )}
          </li>
          {event.location_name || event.location_address ? (
            <li className="flex items-center gap-2">
              <MapPin className="size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                {event.location_name}
                {event.location_address ? (
                  <>
                    {event.location_name ? " · " : null}
                    <a
                      href={mapsUrl(event.location_address)}
                      className="inline-flex min-h-11 items-center font-medium text-brand-700 hover:underline"
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <aside className="space-y-6 lg:sticky lg:top-24 lg:col-start-2 lg:row-start-1">
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
                  guestCount={rsvp?.guest_count ?? 0}
                  shareWithKitchen={shareWithKitchen}
                />
              </div>
            </Card>
          ) : null}
          <div className="hidden lg:block">
            <ContactCard contact={{ name: event.contact_name, email: event.contact_email, phone: event.contact_phone }} />
          </div>
          <p className="hidden text-center text-sm lg:block">
            <Link href="/events" className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
              ← All events
            </Link>
          </p>
        </aside>

        <div className="space-y-6 lg:col-start-1 lg:row-start-1">
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
          <EventHelpOut shifts={shifts} slug={event.slug} signedIn={Boolean(viewer)} />
          <div className="lg:hidden">
            <ContactCard contact={{ name: event.contact_name, email: event.contact_email, phone: event.contact_phone }} />
          </div>
        </div>
      </div>
    </article>
  );
}
