import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MealDisclaimer } from "@/components/menu/meal-disclaimer";

export const metadata: Metadata = { title: "Meals & allergies" };

export default function MealSafetyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Meals & allergies"
        description="How our menus work, what the allergen labels mean, and how to stay safe with a food allergy."
      />

      <Card>
        <h2 className="text-lg font-bold text-ink">How to read a menu</h2>
        <dl className="mt-3 space-y-4 text-base text-ink">
          <div>
            <dt className="flex items-center gap-2 font-semibold">
              <Badge tone="red">Contains</Badge>
            </dt>
            <dd className="mt-1 text-muted">Allergens that come from the dish&apos;s ingredient list, entered by our staff.</dd>
          </div>
          <div>
            <dt className="flex items-center gap-2 font-semibold">
              <Badge tone="amber">May contain (cross-contact)</Badge>
            </dt>
            <dd className="mt-1 text-muted">
              Allergens the dish could come into contact with — shared trays, fryers, cutting boards or serving areas —
              entered by the kitchen.
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Related allergens</dt>
            <dd className="mt-1 text-muted">
              Sesame seeds and sesame oil are tracked separately, as are wheat and gluten. If you saved one, we also point
              out the other.
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-ink">How menus are published</h2>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-base leading-relaxed text-ink">
          <li>Staff list every dish with its ingredients and allergens. You can see them before you RSVP.</li>
          <li>
            Before a menu is published, a staff member confirms the ingredients, preparation and cross-contact details
            match how the food will actually be made.
          </li>
          <li>Menus are versioned. Every change is posted on the event page with a short note.</li>
          <li>Urgent changes that affect allergens notify everyone who RSVP&apos;d.</li>
        </ul>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-ink">Votes and suggestions</h2>
        <p className="mt-2 text-base leading-relaxed text-ink">
          Favorites, votes and suggestions help us plan, but they&apos;re advisory — our staff choose the final menu. A
          popular dish is <strong>never</strong> a sign that it suits someone with an allergy. We never label food
          &ldquo;allergen-free&rdquo; or guaranteed, because our kitchen is shared.
        </p>
      </Card>

      <Card>
        <h2 className="text-lg font-bold text-ink">Your dietary information</h2>
        <p className="mt-2 text-base leading-relaxed text-ink">
          Save your allergies and diet on{" "}
          <Link href="/profile/dietary" className="font-semibold text-brand-700 hover:underline">
            Dietary &amp; allergies
          </Link>{" "}
          to get personal alerts on menus. Only you see it — plus kitchen staff and admins for events you RSVP to, for
          food preparation only (every view is logged). Organizers see anonymous counts.
        </p>
      </Card>

      <MealDisclaimer headingLevel={2} />
    </div>
  );
}
