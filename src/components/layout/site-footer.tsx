import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { FOOTER_NAV, SITE } from "@/config/site";
import { getOrgSettings } from "@/lib/settings";

export async function SiteFooter() {
  const org = await getOrgSettings();
  return (
    <footer className="mt-16 border-t border-stone-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:px-6 md:gap-8 md:px-8 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          <p className="text-lg font-extrabold text-ink">{org.name || SITE.name}</p>
          <p className="max-w-md text-sm text-muted">{SITE.footerBlurb}</p>
          <div className="flex flex-col gap-2 text-sm">
            {org.address ? (
              <address className="not-italic">
                <Link href="/find-us" className="inline-flex min-h-11 items-start gap-2 font-medium text-brand-700 hover:underline">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <span className="whitespace-pre-line">{org.address}</span>
                </Link>
              </address>
            ) : null}
            {org.contact_email ? (
              <a href={`mailto:${org.contact_email}`} className="inline-flex min-h-11 items-center gap-2 font-medium text-brand-700 hover:underline">
                <Mail className="size-4" aria-hidden="true" /> {org.contact_email}
              </a>
            ) : null}
            {org.contact_phone ? (
              <a href={`tel:${org.contact_phone.replace(/[^+\d]/g, "")}`} className="inline-flex min-h-11 items-center gap-2 font-medium text-brand-700 hover:underline">
                <Phone className="size-4" aria-hidden="true" /> {org.contact_phone}
              </a>
            ) : null}
          </div>
        </div>
        <nav aria-label="Footer">
          <ul className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} prefetch={false} className="inline-flex min-h-11 items-center font-medium text-muted hover:text-ink hover:underline">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <div className="border-t border-stone-100">
        <p className="mx-auto max-w-6xl px-4 py-4 text-sm text-muted sm:px-6 md:px-8">
          {/* Search listing turns on at launch, so this note goes away with it. */}
          {SITE.listInSearchEngines ? null : <span className="block pb-1">Still being set up. Not launched yet.</span>}
          © {new Date().getFullYear()} {org.name || SITE.name}. {SITE.independenceNote} Menus and allergen details are
          provided by our organizers — please contact them directly about serious allergies.
        </p>
      </div>
    </footer>
  );
}
