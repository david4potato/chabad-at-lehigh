"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";
import { ALLERGEN_CODES } from "@/lib/allergens";

const MENU_STAFF = ["organizer", "kitchen_staff", "admin"] as const;
const FORBIDDEN: ActionResult = { ok: false, error: "You don't have permission to do that." };
const id = z.guid();
const allergenList = z.array(z.enum(ALLERGEN_CODES as [string, ...string[]]));

const dishSchema = z.object({
  id: z.union([z.literal(""), id]).optional(),
  name: z.string().trim().min(2, "Please enter a name.").max(120),
  description: z.string().trim().max(1000).optional().transform((v) => v || null),
  category: z.enum(["appetizer", "soup", "salad", "bread", "main", "side", "dessert", "drink", "other"]),
  kosher_type: z.union([z.literal(""), z.enum(["meat", "dairy", "pareve"])]).optional().transform((v) => v || null),
  diet_tags: z.array(z.enum(["vegetarian", "vegan"])),
  status: z.enum(["active", "proposed", "archived"]),
});

export async function saveDish(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  const parsed = dishSchema.safeParse({ ...Object.fromEntries(formData), diet_tags: formData.getAll("diet_tags").map(String) });
  if (!parsed.success) return validationError(parsed.error);
  const { id: dishId, ...values } = parsed.data;
  const supabase = await createClient();
  if (dishId) {
    const { error } = await supabase.from("dishes").update(values).eq("id", dishId);
    if (error) return { ok: false, error: error.code === "23505" ? "A dish with that name already exists." : dbErrorMessage(error) };
    revalidatePath("/admin/dishes", "layout");
    return { ok: true, message: "Dish saved. Published menus don't change until you publish a new version." };
  }
  const { data, error } = await supabase.from("dishes").insert(values).select("id").single();
  if (error) return { ok: false, error: error.code === "23505" ? "A dish with that name already exists." : dbErrorMessage(error) };
  revalidatePath("/admin/dishes", "layout");
  redirect(`/admin/dishes/${data.id}?created=1`);
}

export async function deleteDish(dishId: string): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  if (!id.safeParse(dishId).success) return { ok: false, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("dishes").delete().eq("id", dishId);
  if (error) {
    return {
      ok: false,
      error: error.code === "23503" ? "This dish is on a menu, so it can't be deleted. Set its status to Archived instead." : dbErrorMessage(error),
    };
  }
  revalidatePath("/admin/dishes", "layout");
  redirect("/admin/dishes?deleted=1");
}

/** Add an existing ingredient, or create a new one (with its allergens) and add it. */
export async function addDishIngredient(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  const parsed = z
    .object({
      dish_id: id,
      ingredient_id: z.union([z.literal(""), id]).optional(),
      new_name: z.string().trim().max(120).optional(),
      new_allergens: allergenList,
      quantity_note: z.string().trim().max(120).optional().transform((v) => v || null),
      is_optional: z.boolean(),
    })
    .safeParse({
      ...Object.fromEntries(formData),
      new_allergens: formData.getAll("new_allergens").map(String),
      is_optional: formData.get("is_optional") === "on",
    });
  if (!parsed.success) return validationError(parsed.error);
  const d = parsed.data;
  const supabase = await createClient();

  let ingredientId = d.ingredient_id || null;
  if (!ingredientId) {
    if (!d.new_name) return { ok: false, error: "Choose an ingredient or type a new one." };
    const { data: created, error } = await supabase.from("ingredients").insert({ name: d.new_name }).select("id").single();
    if (error) return { ok: false, error: error.code === "23505" ? "That ingredient already exists — pick it from the list." : dbErrorMessage(error) };
    ingredientId = created.id;
    if (d.new_allergens.length) {
      const { error: aErr } = await supabase
        .from("ingredient_allergens")
        .insert(d.new_allergens.map((code) => ({ ingredient_id: ingredientId!, allergen_code: code })));
      if (aErr) return { ok: false, error: dbErrorMessage(aErr) };
    }
  }

  const { data: last } = await supabase
    .from("dish_ingredients")
    .select("sort_order")
    .eq("dish_id", d.dish_id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { error } = await supabase.from("dish_ingredients").insert({
    dish_id: d.dish_id,
    ingredient_id: ingredientId,
    quantity_note: d.quantity_note,
    is_optional: d.is_optional,
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "That ingredient is already in this dish." : dbErrorMessage(error) };
  revalidatePath(`/admin/dishes/${d.dish_id}`);
  revalidatePath("/admin/dishes");
  return { ok: true, message: "Ingredient added." };
}

export async function removeDishIngredient(dishId: string, ingredientId: string): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  if (!id.safeParse(dishId).success || !id.safeParse(ingredientId).success) return { ok: false, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("dish_ingredients").delete().eq("dish_id", dishId).eq("ingredient_id", ingredientId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/admin/dishes/${dishId}`);
  return { ok: true, message: "Ingredient removed." };
}

const ingredientSchema = z.object({
  id: z.union([z.literal(""), id]).optional(),
  name: z.string().trim().min(1, "Please enter a name.").max(120),
  notes: z.string().trim().max(500).optional().transform((v) => v || null),
  allergens: allergenList,
});

export async function saveIngredient(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  const parsed = ingredientSchema.safeParse({ ...Object.fromEntries(formData), allergens: formData.getAll("allergens").map(String) });
  if (!parsed.success) return validationError(parsed.error);
  const { id: ingredientId, allergens, ...values } = parsed.data;
  const supabase = await createClient();

  let targetId = ingredientId || null;
  if (targetId) {
    const { error } = await supabase.from("ingredients").update(values).eq("id", targetId);
    if (error) return { ok: false, error: error.code === "23505" ? "An ingredient with that name already exists." : dbErrorMessage(error) };
  } else {
    const { data, error } = await supabase.from("ingredients").insert(values).select("id").single();
    if (error) return { ok: false, error: error.code === "23505" ? "An ingredient with that name already exists." : dbErrorMessage(error) };
    targetId = data.id;
  }

  let remove = supabase.from("ingredient_allergens").delete().eq("ingredient_id", targetId);
  if (allergens.length) remove = remove.not("allergen_code", "in", `(${allergens.join(",")})`);
  const { error: rErr } = await remove;
  if (rErr) return { ok: false, error: dbErrorMessage(rErr) };
  if (allergens.length) {
    const { error: iErr } = await supabase
      .from("ingredient_allergens")
      .upsert(allergens.map((code) => ({ ingredient_id: targetId!, allergen_code: code })), { ignoreDuplicates: true });
    if (iErr) return { ok: false, error: dbErrorMessage(iErr) };
  }
  revalidatePath("/admin/ingredients");
  revalidatePath("/admin/dishes", "layout");
  return { ok: true, message: ingredientId ? "Ingredient saved. Published menus don't change until you publish a new version." : "Ingredient added." };
}

export async function deleteIngredient(ingredientId: string): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  if (!id.safeParse(ingredientId).success) return { ok: false, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").delete().eq("id", ingredientId);
  if (error) return { ok: false, error: error.code === "23503" ? "This ingredient is used in a dish. Remove it from those dishes first." : dbErrorMessage(error) };
  revalidatePath("/admin/ingredients");
  return { ok: true, message: "Ingredient deleted." };
}

export async function reviewSuggestion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await viewerWithRole(MENU_STAFF);
  if (!viewer) return FORBIDDEN;
  const parsed = z
    .object({
      id,
      status: z.enum(["new", "under_review", "accepted", "declined"]),
      staff_response: z.string().trim().max(1000).optional().transform((v) => v || null),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("dish_suggestions")
    .update({ status: parsed.data.status, staff_response: parsed.data.staff_response, reviewed_by: viewer.id, reviewed_at: new Date().toISOString() })
    .eq("id", parsed.data.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/suggestions");
  revalidatePath("/admin");
  return { ok: true, message: "Saved." };
}
