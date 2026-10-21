import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MealDisclaimer } from "@/components/menu/meal-disclaimer";

export const metadata: Metadata = { title: "Meals & allergies" };

export default function MealSafetyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Meals & allergies" description="How to read our menus, and what to do if you have a food allergy." />

      <Card>
        <h2 className="text-lg font-bold text-ink">Reading a menu</h2>
        <dl className="mt-3 space-y-3 text-base text-ink">
          <div>
            <dt>
              <Badge tone="red">Contains</Badge>
            </dt>
            <dd className="mt-1 text-muted">From the dish&apos;s ingredient list.</dd>
          </div>
          <div>
            <dt>
              <Badge tone="amber">May contain (cross-contact)</Badge>
            </dt>
            <dd className="mt-1 text-muted">Possible contact from shared trays, fryers, boards or serving areas — noted by the kitchen.</dd>
          </div>
          <div>
            <dt className="font-semibold">Related allergens</dt>
            <dd className="mt-1 text-muted">Sesame seeds and sesame oil are listed separately, as are wheat and gluten. We point out both.</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-ink">How menus are published</h2>
        <ul className="mt-2 list-disc space-y-2 pl-6 text-base leading-relaxed text-ink">
          <li>
            Once a menu is posted, every dish lists its ingredients and allergens, and you can see it without RSVPing.
            Menus are often posted after RSVPs open, so check back before the event.
          </li>
          <li>Staff confirm preparation and cross-contact details before publishing.</li>
          <li>
            Changes get a new version with a note; urgent ones appear in the in-app notifications of everyone who
            RSVP&apos;d.
          </li>
          <li>
            Votes and suggestions are advisory. A popular dish is <strong>never</strong> a sign it suits an allergy, and we
            never label food &ldquo;allergen-free&rdquo;.
          </li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-ink">Your dietary information</h2>
        <p className="mt-2 text-base leading-relaxed text-ink">
          Save it in{" "}
          <Link href="/profile/dietary" className="font-semibold text-brand-700 hover:underline">
            Dietary &amp; allergies
          </Link>{" "}
          for personal menu alerts. Only you and kitchen staff/admins (for events you RSVP to, logged) see it; organizers see
          anonymous counts once at least 5 people share.
        </p>
      </Card>

      <MealDisclaimer headingLevel={2} />
    </div>
  );
}
