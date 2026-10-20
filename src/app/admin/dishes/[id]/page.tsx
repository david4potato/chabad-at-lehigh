import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { allergenLabel } from "@/lib/allergens";
import { Card, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { AllergenBadges } from "@/components/menu/allergen-badges";
import { AddIngredientForm, DeleteDishButton, DishForm, RemoveIngredientButton } from "@/components/admin/menu/library-forms";

export const metadata: Metadata = { title: "Dish" };

export default async function DishPage({ params, searchParams }: PageProps<"/admin/dishes/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await requireRole(["organizer", "kitchen_staff", "admin"], `/admin/dishes/${id}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  // Opened from an event's menu (?event=): only used to link back to that menu.
  const eventId = typeof query.event === "string" && /^[0-9a-f-]{36}$/i.test(query.event) ? query.event : null;
  const supabase = await createClient();
  const [{ data: dish }, { data: items }, { data: ingredients }, { data: fromEvent }] = await Promise.all([
    supabase.from("dishes").select("id, name, description, category, kosher_type, diet_tags, status").eq("id", id).maybeSingle(),
    supabase
      .from("dish_ingredients")
      .select("ingredient_id, quantity_note, is_optional, sort_order, ingredient:ingredients(name, notes, allergens:ingredient_allergens(allergen_code))")
      .eq("dish_id", id)
      .order("sort_order"),
    supabase.from("ingredients").select("id, name").order("name"),
    eventId ? supabase.from("events").select("id, title").eq("id", eventId).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  if (!dish) notFound();

  const list = items ?? [];
  const required = new Set(list.filter((i) => !i.is_optional).flatMap((i) => i.ingredient?.allergens.map((a) => a.allergen_code) ?? []));
  const all = [...new Set(list.flatMap((i) => i.ingredient?.allergens.map((a) => a.allergen_code) ?? []))];
  const used = new Set(list.map((i) => i.ingredient_id));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        {fromEvent ? (
          <Link href={`/admin/events/${fromEvent.id}/menu`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
            ← Back to the {fromEvent.title} menu
          </Link>
        ) : (
          <Link href="/admin/dishes" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
            ← All dishes
          </Link>
        )}
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{dish.name}</h1>
      </div>
      {query.created ? <Alert tone="success">Dish created. Now add its ingredients below.</Alert> : null}
      <Alert tone="info">
        Editing a dish doesn&apos;t change menus that are already published. Publish a new menu version to update them.
      </Alert>

      <Card>
        <CardTitle>Ingredients</CardTitle>
        <div className="mt-2">
          {all.length ? (
            <AllergenBadges codes={all} optionalOnly={all.filter((a) => !required.has(a))} />
          ) : (
            <p className="text-sm text-muted">No allergens in the ingredients listed so far.</p>
          )}
        </div>
        {list.length ? (
          <ul className="mt-4 divide-y divide-stone-100 rounded-xl border border-stone-200">
            {list.map((i) => (
              <li key={i.ingredient_id} className="flex items-start justify-between gap-3 px-3 py-3">
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-ink">
                    {i.ingredient?.name}
                    {i.quantity_note ? <span className="font-normal text-muted"> ({i.quantity_note})</span> : null}
                    {i.is_optional ? <span className="ml-1 text-sm font-semibold text-muted">optional</span> : null}
                  </p>
                  {i.ingredient?.allergens.length ? (
                    <p className="text-sm font-semibold text-red-800">{i.ingredient.allergens.map((a) => allergenLabel(a.allergen_code)).join(", ")}</p>
                  ) : null}
                  {i.ingredient?.notes ? <p className="text-sm text-muted">{i.ingredient.notes}</p> : null}
                </div>
                <RemoveIngredientButton dishId={dish.id} ingredientId={i.ingredient_id} name={i.ingredient?.name ?? "ingredient"} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">No ingredients yet.</p>
        )}
        <div className="mt-6 border-t border-stone-100 pt-6">
          <AddIngredientForm dishId={dish.id} ingredients={(ingredients ?? []).filter((i) => !used.has(i.id))} />
        </div>
      </Card>

      <Card>
        <CardTitle>Details</CardTitle>
        <div className="mt-4">
          <DishForm dish={dish} />
        </div>
      </Card>

      <DeleteDishButton dishId={dish.id} />
    </div>
  );
}
