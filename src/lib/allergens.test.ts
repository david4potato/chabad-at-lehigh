import { describe, expect, it } from "vitest";
import {
  ALLERGEN_CODES,
  RELATED_ALLERGENS,
  allergenLabel,
  dietLabel,
  isAllergenCode,
  matchDishAllergens,
  type ProfileAllergen,
} from "./allergens";

const dish = (d: { allergens?: string[]; optionalOnly?: string[]; crossContact?: string[] }) => ({
  allergens: d.allergens ?? [],
  optionalOnly: d.optionalOnly,
  crossContact: d.crossContact ?? [],
});

describe("matchDishAllergens", () => {
  it("flags allergens the dish contains", () => {
    const profile: ProfileAllergen[] = [{ code: "milk", severity: "allergy" }];
    expect(matchDishAllergens(dish({ allergens: ["milk", "wheat"] }), profile)).toEqual([
      { code: "milk", severity: "allergy", kind: "contains" },
    ]);
  });

  it("marks allergens that only appear in optional ingredients", () => {
    const profile: ProfileAllergen[] = [{ code: "tree_nuts", severity: "severe" }];
    expect(
      matchDishAllergens(dish({ allergens: ["tree_nuts", "egg"], optionalOnly: ["tree_nuts"] }), profile),
    ).toEqual([{ code: "tree_nuts", severity: "severe", kind: "contains_optional" }]);
  });

  it("flags kitchen-entered cross-contact", () => {
    const profile: ProfileAllergen[] = [{ code: "peanuts", severity: "severe" }];
    expect(matchDishAllergens(dish({ crossContact: ["peanuts"] }), profile)).toEqual([
      { code: "peanuts", severity: "severe", kind: "cross_contact" },
    ]);
  });

  it("prefers contains over cross-contact when both apply", () => {
    const profile: ProfileAllergen[] = [{ code: "soy", severity: "intolerance" }];
    expect(matchDishAllergens(dish({ allergens: ["soy"], crossContact: ["soy"] }), profile)).toEqual([
      { code: "soy", severity: "intolerance", kind: "contains" },
    ]);
  });

  it("points out sesame oil when you flagged sesame seeds, and the reverse", () => {
    expect(
      matchDishAllergens(dish({ allergens: ["sesame_oil"] }), [{ code: "sesame_seed", severity: "allergy" }]),
    ).toEqual([{ code: "sesame_seed", severity: "allergy", kind: "related", relatedTo: "sesame_oil" }]);

    expect(
      matchDishAllergens(dish({ allergens: ["sesame_seed"] }), [{ code: "sesame_oil", severity: "allergy" }]),
    ).toEqual([{ code: "sesame_oil", severity: "allergy", kind: "related", relatedTo: "sesame_seed" }]);
  });

  it("points out wheat and gluten as related", () => {
    expect(matchDishAllergens(dish({ allergens: ["gluten"] }), [{ code: "wheat", severity: "allergy" }])).toEqual([
      { code: "wheat", severity: "allergy", kind: "related", relatedTo: "gluten" },
    ]);
    expect(
      matchDishAllergens(dish({ allergens: ["wheat"] }), [{ code: "gluten", severity: "intolerance" }]),
    ).toEqual([{ code: "gluten", severity: "intolerance", kind: "related", relatedTo: "wheat" }]);
  });

  it("points out related allergens that only appear as cross-contact", () => {
    expect(
      matchDishAllergens(dish({ crossContact: ["sesame_seed"] }), [{ code: "sesame_oil", severity: "severe" }]),
    ).toEqual([{ code: "sesame_oil", severity: "severe", kind: "related", relatedTo: "sesame_seed" }]);
  });

  it("reports direct and related matches separately for someone who flagged both", () => {
    const profile: ProfileAllergen[] = [
      { code: "sesame_seed", severity: "severe" },
      { code: "sesame_oil", severity: "allergy" },
    ];
    expect(matchDishAllergens(dish({ allergens: ["sesame_oil"] }), profile)).toEqual([
      { code: "sesame_seed", severity: "severe", kind: "related", relatedTo: "sesame_oil" },
      { code: "sesame_oil", severity: "allergy", kind: "contains" },
    ]);
  });

  it("returns an empty array when nothing matches (which never means the dish is safe)", () => {
    expect(
      matchDishAllergens(dish({ allergens: ["milk"], crossContact: ["egg"] }), [{ code: "fish", severity: "allergy" }]),
    ).toEqual([]);
    expect(matchDishAllergens(dish({ allergens: ["milk"] }), [])).toEqual([]);
    expect(matchDishAllergens(dish({}), [{ code: "milk", severity: "allergy" }])).toEqual([]);
  });

  it("does not treat unrelated allergens as related", () => {
    expect(matchDishAllergens(dish({ allergens: ["tree_nuts"] }), [{ code: "peanuts", severity: "severe" }])).toEqual(
      [],
    );
  });
});

describe("allergen reference data", () => {
  it("tracks sesame seeds and sesame oil separately", () => {
    expect(ALLERGEN_CODES).toContain("sesame_seed");
    expect(ALLERGEN_CODES).toContain("sesame_oil");
  });

  it("keeps related allergens symmetric", () => {
    for (const [code, related] of Object.entries(RELATED_ALLERGENS)) {
      for (const rel of related ?? []) {
        expect(RELATED_ALLERGENS[rel]).toContain(code);
      }
    }
  });

  it("labels known and unknown codes", () => {
    expect(allergenLabel("sesame_oil")).toBe("Sesame oil");
    expect(allergenLabel("pine_nut")).toBe("pine nut");
    expect(isAllergenCode("milk")).toBe(true);
    expect(isAllergenCode("pine_nut")).toBe(false);
    expect(dietLabel("no_red_meat")).toBe("No red meat");
    expect(dietLabel("raw_food")).toBe("raw food");
  });
});

describe("matchDishAllergens with several kinds of match", () => {
  it("reports cross-contact AND a related ingredient for the same flagged allergen", () => {
    const result = matchDishAllergens(
      { allergens: ["sesame_oil", "soy"], optionalOnly: [], crossContact: ["sesame_seed"] },
      [{ code: "sesame_seed", severity: "severe" }],
    );
    expect(result).toEqual([
      { code: "sesame_seed", severity: "severe", kind: "cross_contact" },
      { code: "sesame_seed", severity: "severe", kind: "related", relatedTo: "sesame_oil" },
    ]);
  });
});
