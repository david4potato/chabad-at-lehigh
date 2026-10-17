import { Mail, Phone } from "lucide-react";
import { getOrgSettings } from "@/lib/settings";
import { Card, CardTitle } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";
import { telHref } from "./event-utils";

/** "Questions? Contact the organizer" — event contact first, organization contact as fallback. */
export async function ContactCard({
  contact,
}: {
  contact: { name: string | null; email: string | null; phone: string | null };
}) {
  let { name, email, phone } = contact;
  if (!email && !phone) {
    const org = await getOrgSettings();
    name = org.contact_name || name;
    email = org.contact_email || null;
    phone = org.contact_phone || null;
  }
  return (
    <Card>
      <CardTitle>Questions?</CardTitle>
      <p className="mt-1 text-sm text-muted">
        {name ? `Reach out to ${name}` : "Reach out to the organizer"} — about the event, guests, or food allergies.
      </p>
      {email || phone ? (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          {email ? (
            <a href={`mailto:${email}`} className={buttonClasses("secondary", "md", "w-full sm:w-auto")}>
              <Mail className="size-4" aria-hidden="true" /> Email
            </a>
          ) : null}
          {phone ? (
            <a href={telHref(phone)} className={buttonClasses("secondary", "md", "w-full sm:w-auto")}>
              <Phone className="size-4" aria-hidden="true" /> Call or text
            </a>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">Contact details will be added soon.</p>
      )}
    </Card>
  );
}
