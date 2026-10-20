import { AlertTriangle, ChevronDown, OctagonAlert } from "lucide-react";
import { allergenLabel, type AllergenMatch } from "@/lib/allergens";
import { optionalOnlyAllergens, type MenuItem } from "@/lib/menu";
import { Badge } from "@/components/ui/badge";
import { AllergenBadges } from "./allergen-badges";
import { describeMatch, dishTags, sortAllergens } from "./menu-helpers";
import { FavoriteButton } from "./vote-buttons";

type Props = {
  item: MenuItem;
  matches: AllergenMatch[];
  favorite: { active: boolean; count: number } | null;
};

/** One dish on a menu: what it contains, what it may contain, ingredients, and personal alerts. */
export function DishCard({ item, matches, favorite }: Props) {
  const { dish } = item;
  const optionalOnly = optionalOnlyAllergens(dish);
  const tags = dishTags(dish);
  const severe = matches.some((m) => m.severity === "severe");

  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-base font-bold text-ink">{dish.name}</h4>
          {dish.description ? <p className="mt-1 text-sm text-muted">{dish.description}</p> : null}
          {tags.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((t) => (
                <Badge key={t}>{t}</Badge>
              ))}
            </div>
          ) : null}
        </div>
        {favorite ? <FavoriteButton dishId={dish.id} dishName={dish.name} initial={favorite} /> : null}
      </div>

      {matches.length > 0 ? (
        <div
          className={
            severe
              ? "mt-3 flex gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900"
              : "mt-3 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          }
        >
          {severe ? (
            <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <div>
            {/* Severity is said in words, not only by the red box. */}
            <p className="font-semibold">{severe ? "Severe allergy match:" : "Your allergies:"}</p>
            <ul className="mt-1 list-disc pl-4">
              {matches.map((m) => (
                <li key={`${m.code}-${m.kind}-${m.relatedTo ?? ""}`}>
                  {describeMatch(m, dish.allergens)}
                  {m.severity === "severe" ? " (you marked this severe)" : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      <div className="mt-3 space-y-2">
        {dish.allergens.length > 0 ? (
          <AllergenBadges codes={dish.allergens} optionalOnly={optionalOnly} />
        ) : dish.ingredients.length === 0 ? (
          <p className="text-sm font-medium text-amber-950">
            Ingredients not listed yet — if you have an allergy, ask the organizer before eating this.
          </p>
        ) : (
          <p className="text-sm text-muted">No allergens listed in the ingredients.</p>
        )}
        {item.cross_contact_allergens.length > 0 ? (
          <AllergenBadges codes={item.cross_contact_allergens} kind="may_contain" />
        ) : null}
        {item.cross_contact_notes ? (
          <p className="text-sm text-ink">
            <span className="font-semibold">Cross-contact: </span>
            {item.cross_contact_notes}
          </p>
        ) : null}
        {item.preparation_notes ? (
          <p className="text-sm text-ink">
            <span className="font-semibold">Preparation: </span>
            {item.preparation_notes}
          </p>
        ) : null}
      </div>

      {dish.ingredients.length > 0 ? (
        <details className="group mt-3 rounded-xl bg-stone-50 px-3 py-1 text-sm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
            Ingredients ({dish.ingredients.length})
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <ul className="space-y-2 pb-3">
            {dish.ingredients.map((ing) => (
              <li key={ing.name} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium text-ink">
                  {ing.name}
                  {ing.quantity_note ? <span className="font-normal text-muted"> ({ing.quantity_note})</span> : null}
                </span>
                {ing.optional ? <span className="text-sm font-semibold text-muted">optional</span> : null}
                {ing.allergens.length > 0 ? (
                  <span className="text-sm font-semibold text-red-800">
                    {sortAllergens(ing.allergens).map(allergenLabel).join(", ")}
                  </span>
                ) : null}
                {ing.notes ? <span className="w-full text-sm text-muted">{ing.notes}</span> : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}
