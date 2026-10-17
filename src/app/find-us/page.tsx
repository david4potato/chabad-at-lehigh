import type { Metadata } from "next";
import { Car, Mail, MapPin, Navigation, Phone } from "lucide-react";
import { getOrgSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonClasses } from "@/components/ui/button";
import { paragraphs, telHref } from "@/components/events/event-utils";

export const metadata: Metadata = { title: "Find Us" };

export default async function FindUsPage() {
  const org = await getOrgSettings();
  const query = org.map_query.trim() || org.address.trim();
  const q = encodeURIComponent(query);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader title="Find Us" description="We'd love to see you. Here's how to get here." />

      {query ? (
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700">
              <MapPin className="size-5" aria-hidden="true" />
            </span>
            <div>
              <CardTitle>{org.name}</CardTitle>
              {org.address ? <p className="mt-1 whitespace-pre-line text-base text-ink">{org.address}</p> : null}
            </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} className={buttonClasses("primary", "md", "w-full")} target="_blank" rel="noopener noreferrer">
              <Navigation className="size-4" aria-hidden="true" /> Get directions
            </a>
            <a href={`https://maps.apple.com/?q=${q}`} className={buttonClasses("secondary", "md", "w-full")} target="_blank" rel="noopener noreferrer">
              Apple Maps
            </a>
            <a href={`https://www.google.com/maps/search/?api=1&query=${q}`} className={buttonClasses("secondary", "md", "w-full")} target="_blank" rel="noopener noreferrer">
              Google Maps
            </a>
          </div>
        </Card>
      ) : (
        <EmptyState title="Address coming soon">Please contact the organizer for directions.</EmptyState>
      )}

      {org.directions ? (
        <Card>
          <CardTitle className="flex items-center gap-2">
            <Navigation className="size-5 text-brand-700" aria-hidden="true" /> Directions
          </CardTitle>
          <div className="prose-simple mt-2 text-base leading-relaxed text-ink">
            {paragraphs(org.directions).map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))}
          </div>
        </Card>
      ) : null}

      {org.parking ? (
        <Card>
          <CardTitle className="flex items-center gap-2">
            <Car className="size-5 text-brand-700" aria-hidden="true" /> Parking
          </CardTitle>
          <div className="prose-simple mt-2 text-base leading-relaxed text-ink">
            {paragraphs(org.parking).map((p, i) => (
              <p key={i} className="whitespace-pre-line">{p}</p>
            ))}
          </div>
        </Card>
      ) : null}

      {org.contact_email || org.contact_phone ? (
        <Card>
          <CardTitle>Need help finding us?</CardTitle>
          <p className="mt-1 text-sm text-muted">
            {org.contact_name ? `${org.contact_name} is happy to help.` : "We're happy to help."}
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            {org.contact_phone ? (
              <a href={telHref(org.contact_phone)} className={buttonClasses("secondary", "md", "w-full sm:w-auto")}>
                <Phone className="size-4" aria-hidden="true" /> {org.contact_phone}
              </a>
            ) : null}
            {org.contact_email ? (
              <a href={`mailto:${org.contact_email}`} className={buttonClasses("secondary", "md", "w-full sm:w-auto")}>
                <Mail className="size-4" aria-hidden="true" /> Email us
              </a>
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
