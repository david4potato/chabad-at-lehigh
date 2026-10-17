// Types and helpers for the JSON returned by the get_event_menu() database
// function. Published menus come from frozen snapshots taken at publish time.

export type MenuIngredient = {
  name: string;
  notes: string | null;
  quantity_note: string | null;
  optional: boolean;
  allergens: string[];
};

export type MenuDish = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  kosher_type: "meat" | "dairy" | "pareve" | null;
  diet_tags: string[];
  ingredients: MenuIngredient[];
  allergens: string[];
};

export type MenuItem = {
  id: string;
  course: string;
  sort_order: number;
  preparation_notes: string | null;
  cross_contact_notes: string | null;
  cross_contact_allergens: string[];
  dish: MenuDish;
};

export type MenuVersionInfo = {
  id: string;
  version: number;
  status: "draft" | "published" | "archived";
  title: string | null;
  change_summary: string | null;
  kitchen_notes: string | null;
  prep_confirmed_at: string | null;
  published_at: string | null;
};

export type MenuUpdate = { id: string; message: string; is_urgent: boolean; created_at: string };

export type EventMenu = {
  event_id: string;
  version: MenuVersionInfo | null;
  items: MenuItem[];
  updates: MenuUpdate[];
};

export const COURSE_ORDER = ["drink", "bread", "appetizer", "soup", "salad", "main", "side", "dessert", "other"] as const;

export const COURSE_LABELS: Record<string, string> = {
  drink: "Drinks",
  bread: "Bread",
  appetizer: "Appetizers",
  soup: "Soup",
  salad: "Salads",
  main: "Mains",
  side: "Sides",
  dessert: "Dessert",
  other: "Other",
};

export function parseEventMenu(data: unknown): EventMenu | null {
  if (!data || typeof data !== "object") return null;
  const m = data as EventMenu;
  return {
    event_id: m.event_id,
    version: m.version ?? null,
    items: Array.isArray(m.items) ? m.items : [],
    updates: Array.isArray(m.updates) ? m.updates : [],
  };
}

/** Allergens that appear ONLY in optional ingredients (e.g. "walnut topping on half"). */
export function optionalOnlyAllergens(dish: MenuDish): string[] {
  const required = new Set(dish.ingredients.filter((i) => !i.optional).flatMap((i) => i.allergens));
  return dish.allergens.filter((a) => !required.has(a));
}

/** Group items by course in a sensible meal order. */
export function groupByCourse(items: MenuItem[]): { course: string; label: string; items: MenuItem[] }[] {
  const groups = new Map<string, MenuItem[]>();
  for (const item of [...items].sort((a, b) => a.sort_order - b.sort_order)) {
    const list = groups.get(item.course) ?? [];
    list.push(item);
    groups.set(item.course, list);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => COURSE_ORDER.indexOf(a as never) - COURSE_ORDER.indexOf(b as never))
    .map(([course, list]) => ({ course, label: COURSE_LABELS[course] ?? course, items: list }));
}
