import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { getOrgSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";

type Contact = { name?: string | null; email?: string | null; phone?: string | null };

type Props = {
  /** The event's organizer contact. Falls back to the organization's contact (Admin → Settings). */
  contact?: Contact | null;
  /** Heading level, so it fits the page outline (h3 inside a section, h2 on its own). */
  headingLevel?: 2 | 3;
  id?: string;
  className?: string;
};

const clean = (v: string | null | undefined) => v?.trim() ?? "";

/**
 * The meal disclaimer shown with every menu: menus can change, the kitchen is
 * shared, lists and votes are not a guarantee, and how to reach the organizer.
 */
export async function MealDisclaimer({ contact, headingLevel = 3, id = "meal-disclaimer", className }: Props) {
  let name = clean(contact?.name);
  let email = clean(contact?.email);
  let phone = clean(contact?.phone);
  if (!email && !phone) {
    const org = await getOrgSettings();
    name = clean(org.contact_name) || name;
    email = clean(org.contact_email);
    phone = clean(org.contact_phone);
  }
  const Heading = headingLevel === 2 ? "h2" : "h3";

  return (
    <aside
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("scroll-mt-24 rounded-2xl border border-stone-200 bg-white p-4 text-sm sm:p-5", className)}
    >
      <Heading id={`${id}-title`} className="text-base font-bold text-ink">
        About our food and allergies
      </Heading>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed text-muted">
        <li>Menus can change; changes are posted here.</li>
        <li>Shared kitchen — cross-contact is possible.</li>
        <li>Ingredient lists, labels and votes are not a guarantee.</li>
        <li>
          <strong className="font-semibold text-ink">Food allergy? Contact the organizer before the event.</strong>
        </li>
      </ul>

      <div id={`${id}-contact`} className="mt-4 border-t border-stone-100 pt-3">
        <p className="font-semibold text-ink">{name ? `Contact ${name}` : "Contact the organizer"}</p>
        {email || phone ? (
          <div className="mt-1 flex flex-col gap-x-5 sm:flex-row sm:flex-wrap">
            {email ? (
              <a
                href={`mailto:${email}`}
                className="inline-flex min-h-11 items-center gap-2 font-medium break-all text-brand-700 hover:underline"
              >
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                {email}
              </a>
            ) : null}
            {phone ? (
              <a
                href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                className="inline-flex min-h-11 items-center gap-2 font-medium text-brand-700 hover:underline"
              >
                <Phone className="size-4 shrink-0" aria-hidden="true" />
                {phone}
              </a>
            ) : null}
          </div>
        ) : (
          <p className="mt-1 text-muted">
            Please reach out to an organizer before the event — see{" "}
            <Link href="/find-us" className="font-medium text-brand-700 hover:underline">
              Find Us
            </Link>
            .
          </p>
        )}
        <Link href="/meal-safety" className="mt-1 inline-flex min-h-11 items-center font-medium text-brand-700 hover:underline">
          How we handle meals and allergies
        </Link>
      </div>
    </aside>
  );
}
