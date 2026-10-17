import { describe, expect, it } from "vitest";
import { COURSE_ORDER, groupByCourse, optionalOnlyAllergens, parseEventMenu, type MenuDish, type MenuItem } from "./menu";

const makeDish = (overrides: Partial<MenuDish> = {}): MenuDish => ({
  id: "dish",
  name: "Dish",
  description: null,
  category: "main",
  kosher_type: null,
  diet_tags: [],
  ingredients: [],
  allergens: [],
  ...overrides,
});

const item = (id: string, course: string, sort_order: number): MenuItem => ({
  id,
  course,
  sort_order,
  preparation_notes: null,
  cross_contact_notes: null,
  cross_contact_allergens: [],
  dish: makeDish({ id: `dish-${id}`, name: id }),
});

describe("groupByCourse", () => {
  it("orders courses like a meal and items by sort order", () => {
    const groups = groupByCourse([
      item("cake", "dessert", 1),
      item("chicken", "main", 2),
      item("challah", "bread", 1),
      item("brisket", "main", 1),
      item("soup", "soup", 1),
      item("wine", "drink", 3),
      item("kugel", "side", 1),
    ]);

    expect(groups.map((g) => g.course)).toEqual(["drink", "bread", "soup", "main", "side", "dessert"]);
    expect(groups.find((g) => g.course === "main")?.items.map((i) => i.id)).toEqual(["brisket", "chicken"]);
  });

  it("follows COURSE_ORDER for every known course", () => {
    const shuffled = [...COURSE_ORDER].reverse().map((course, i) => item(course, course, i));
    expect(groupByCourse(shuffled).map((g) => g.course)).toEqual([...COURSE_ORDER]);
  });

  it("uses friendly labels and falls back to the raw course name", () => {
    const groups = groupByCourse([item("a", "main", 1), item("b", "brunch", 1)]);
    expect(groups.find((g) => g.course === "main")?.label).toBe("Mains");
    expect(groups.find((g) => g.course === "brunch")?.label).toBe("brunch");
  });

  it("does not mutate the input array", () => {
    const items = [item("b", "main", 2), item("a", "main", 1)];
    groupByCourse(items);
    expect(items.map((i) => i.id)).toEqual(["b", "a"]);
  });

  it("returns no groups for an empty menu", () => {
    expect(groupByCourse([])).toEqual([]);
  });
});

describe("optionalOnlyAllergens", () => {
  it("returns allergens that appear only in optional ingredients", () => {
    const dish = makeDish({
      allergens: ["wheat", "tree_nuts", "egg"],
      ingredients: [
        { name: "Flour", notes: null, quantity_note: null, optional: false, allergens: ["wheat"] },
        { name: "Egg wash", notes: null, quantity_note: null, optional: false, allergens: ["egg"] },
        { name: "Walnut topping", notes: null, quantity_note: null, optional: true, allergens: ["tree_nuts", "wheat"] },
      ],
    });
    expect(optionalOnlyAllergens(dish)).toEqual(["tree_nuts"]);
  });

  it("returns an empty array when every allergen is in a required ingredient", () => {
    const dish = makeDish({
      allergens: ["milk"],
      ingredients: [{ name: "Butter", notes: null, quantity_note: null, optional: false, allergens: ["milk"] }],
    });
    expect(optionalOnlyAllergens(dish)).toEqual([]);
  });
});

describe("parseEventMenu", () => {
  it("returns null for missing or non-object data", () => {
    expect(parseEventMenu(null)).toBeNull();
    expect(parseEventMenu(undefined)).toBeNull();
    expect(parseEventMenu("menu")).toBeNull();
    expect(parseEventMenu(42)).toBeNull();
  });

  it("tolerates null and missing fields", () => {
    expect(parseEventMenu({ event_id: "e1", version: null, items: null, updates: null })).toEqual({
      event_id: "e1",
      version: null,
      items: [],
      updates: [],
    });
    expect(parseEventMenu({ event_id: "e1" })).toEqual({ event_id: "e1", version: null, items: [], updates: [] });
  });

  it("passes through a full menu", () => {
    const version = {
      id: "v1",
      version: 2,
      status: "published",
      title: null,
      change_summary: "Swapped dessert",
      kitchen_notes: null,
      prep_confirmed_at: "2026-10-22T15:00:00Z",
      published_at: "2026-10-22T15:05:00Z",
    };
    const items = [item("a", "main", 1)];
    const updates = [{ id: "u1", message: "Dessert changed", is_urgent: true, created_at: "2026-10-23T12:00:00Z" }];
    expect(parseEventMenu({ event_id: "e1", version, items, updates })).toEqual({
      event_id: "e1",
      version,
      items,
      updates,
    });
  });
});
