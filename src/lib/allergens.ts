// Allergen reference data shared by the UI. The database table
// public.allergens is the source of truth for codes; keep these in sync.

export const ALLERGENS = [
  { code: "milk", label: "Milk / dairy" },
  { code: "egg", label: "Egg" },
  { code: "fish", label: "Fish" },
  { code: "shellfish", label: "Crustacean shellfish" },
  { code: "tree_nuts", label: "Tree nuts" },
  { code: "peanuts", label: "Peanuts" },
  { code: "wheat", label: "Wheat" },
  { code: "gluten", label: "Gluten" },
  { code: "soy", label: "Soy" },
  { code: "sesame_seed", label: "Sesame seeds" },
  { code: "sesame_oil", label: "Sesame oil" },
  { code: "mustard", label: "Mustard" },
  { code: "sulfites", label: "Sulfites" },
] as const;

export type AllergenCode = (typeof ALLERGENS)[number]["code"];
export const ALLERGEN_CODES = ALLERGENS.map((a) => a.code) as AllergenCode[];

const LABELS = Object.fromEntries(ALLERGENS.map((a) => [a.code, a.label])) as Record<string, string>;
export const allergenLabel = (code: string) => LABELS[code] ?? code.replace(/_/g, " ");
export const isAllergenCode = (code: string): code is AllergenCode => code in LABELS;

/**
 * Closely related allergens. If someone flags one, we also point out the
 * other (e.g. sesame seeds vs. sesame oil) instead of staying silent.
 */
export const RELATED_ALLERGENS: Partial<Record<AllergenCode, AllergenCode[]>> = {
  sesame_seed: ["sesame_oil"],
  sesame_oil: ["sesame_seed"],
  wheat: ["gluten"],
  gluten: ["wheat"],
};

export const SEVERITY_LABELS = {
  intolerance: "Intolerance",
  allergy: "Allergy",
  severe: "Severe / anaphylactic",
} as const;
export type Severity = keyof typeof SEVERITY_LABELS;

export const DIETS = [
  { code: "vegetarian", label: "Vegetarian" },
  { code: "vegan", label: "Vegan" },
  { code: "pescatarian", label: "Pescatarian" },
  { code: "no_red_meat", label: "No red meat" },
  { code: "no_fish", label: "No fish" },
  { code: "dairy_free", label: "Dairy-free" },
  { code: "gluten_free", label: "Gluten-free" },
  { code: "low_sodium", label: "Low sodium" },
] as const;
export type DietCode = (typeof DIETS)[number]["code"];
export const DIET_CODES = DIETS.map((d) => d.code) as DietCode[];
const DIET_LABELS = Object.fromEntries(DIETS.map((d) => [d.code, d.label])) as Record<string, string>;
export const dietLabel = (code: string) => DIET_LABELS[code] ?? code.replace(/_/g, " ");

export type ProfileAllergen = { code: string; severity: Severity };

export type AllergenMatch = {
  code: string;
  severity: Severity;
  /** "contains": listed in an ingredient. "cross_contact": kitchen flagged possible contact. */
  kind: "contains" | "contains_optional" | "cross_contact" | "related";
  /** For "related": the allergen actually present (e.g. sesame_oil when you flagged sesame_seed). */
  relatedTo?: string;
};

/**
 * Compare one dish against a person's allergen profile.
 *
 * IMPORTANT: an empty result does NOT mean the dish is safe. It only means no
 * listed ingredient or kitchen cross-contact note matches the profile. The UI
 * must never present an empty result as "safe" or "allergen-free".
 */
export function matchDishAllergens(
  dish: { allergens: string[]; optionalOnly?: string[]; crossContact: string[] },
  profile: ProfileAllergen[],
): AllergenMatch[] {
  const matches: AllergenMatch[] = [];
  const contains = new Set(dish.allergens);
  const optionalOnly = new Set(dish.optionalOnly ?? []);
  const cross = new Set(dish.crossContact);

  for (const { code, severity } of profile) {
    if (contains.has(code)) {
      const opt = optionalOnly.has(code);
      matches.push({ code, severity, kind: opt ? "contains_optional" : "contains" });
      // Skipping an optional ingredient doesn't help if the rest may contain it too.
      if (opt && cross.has(code)) matches.push({ code, severity, kind: "cross_contact" });
    } else if (cross.has(code)) {
      matches.push({ code, severity, kind: "cross_contact" });
    }
    // Always mention related allergens too (e.g. a dish that may contain sesame
    // seeds AND contains sesame oil), keeping the severity the person gave.
    for (const rel of RELATED_ALLERGENS[code as AllergenCode] ?? []) {
      if (contains.has(rel) || cross.has(rel)) {
        matches.push({ code, severity, kind: "related", relatedTo: rel });
      }
    }
  }
  return matches;
}
