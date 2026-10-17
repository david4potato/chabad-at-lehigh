// Small helpers shared by the menu components (text for allergen matches,
// ordering, labels). Kept here so the wording stays consistent everywhere.

import { ALLERGEN_CODES, allergenLabel, dietLabel, type AllergenMatch } from "@/lib/allergens";

/** Sort allergen codes in the standard reference order (milk, egg, fish, ...). */
export function sortAllergens(codes: readonly string[]): string[] {
  const rank = (code: string) => {
    const i = ALLERGEN_CODES.indexOf(code as (typeof ALLERGEN_CODES)[number]);
    return i === -1 ? ALLERGEN_CODES.length : i;
  };
  return [...new Set(codes)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

const lower = (code: string) => allergenLabel(code).toLowerCase();

/**
 * One short, plain sentence explaining why a dish matches someone's saved
 * allergies. Always says which kind of match it is (contains, optional,
 * cross-contact, related). Never implies anything is safe.
 */
export function describeMatch(match: AllergenMatch, dishAllergens: readonly string[]): string {
  switch (match.kind) {
    case "contains":
      return `Contains ${lower(match.code)}`;
    case "contains_optional":
      return `${allergenLabel(match.code)} in an optional ingredient`;
    case "cross_contact":
      return `May contain ${lower(match.code)} (cross-contact)`;
    case "related": {
      const rel = match.relatedTo ?? match.code;
      const how = dishAllergens.includes(rel)
        ? `Contains ${lower(rel)}`
        : `May contain ${lower(rel)} (cross-contact)`;
      return `${how} — you listed ${lower(match.code)}`;
    }
  }
}

export const KOSHER_LABELS: Record<string, string> = { meat: "Meat", dairy: "Dairy", pareve: "Pareve" };

export function dishTags(dish: { kosher_type: string | null; diet_tags: string[] }): string[] {
  return [...(dish.kosher_type ? [KOSHER_LABELS[dish.kosher_type] ?? dish.kosher_type] : []), ...dish.diet_tags.map(dietLabel)];
}

export const ADVISORY_NOTE = "Favorites and votes help us plan. They're advisory — our staff choose the final menu.";

export const signInHref = (slug: string) => `/sign-in?next=${encodeURIComponent(`/events/${slug}#menu`)}`;
