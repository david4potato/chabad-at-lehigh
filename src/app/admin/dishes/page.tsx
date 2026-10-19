import type { Metadata } from "next";
import Link from "next/link";
import { Heart, Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { COURSE_LABELS } from "@/lib/menu";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { AllergenBadges } from "@/components/menu/allergen-badges";

export const metadata: Metadata = { title: "Dishes" };

const STATUSES = ["active", "proposed", "archived"] as const;

export default async function DishesPage({ searchParams }: PageProps<"/admin/dishes">) {
  await requireRole(["organizer", "kitchen_staff", "admin"], "/admin/dishes");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const status = STATUSES.find((s) => s === params.status) ?? "active";
  const supabase = await createClient();

  let query = supabase.from("dishes").select("id, name, category, kosher_type, status, ingredients:dish_ingredients(count)").eq("status", status).order("name").limit(200);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const [{ data: dishes }, { data: allergenRows }, { data: votes }] = await Promise.all([
    query,
    supabase.from("dish_allergens").select("dish_id, allergen_code"),
    supabase.rpc("get_dish_vote_counts", {}),
  ]);
  const allergens = new Map<string, string[]>();
  for (const r of allergenRows ?? []) {
    if (!r.dish_id || !r.allergen_code) continue;
    allergens.set(r.dish_id, [...(allergens.get(r.dish_id) ?? []), r.allergen_code]);
  }
  const favorites = new Map((votes ?? []).map((v) => [v.dish_id, v.votes]));

  return (
    <div>
      <PageHeader
        title="Dishes"
        description="Your dish library. Allergens come from each dish's ingredients."
        actions={
          <>
            <ButtonLink href="/admin/ingredients" variant="secondary">Ingredients</ButtonLink>
            <ButtonLink href="/admin/dishes/new">
              <Plus className="size-4" aria-hidden="true" /> New dish
            </ButtonLink>
          </>
        }
      />
      {params.deleted ? <Alert tone="success" className="mb-4">Dish deleted.</Alert> : null}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <form role="search" className="flex-1">
          <input type="hidden" name="status" value={status} />
          <Input name="q" defaultValue={q} placeholder="Search dishes" aria-label="Search dishes" />
        </form>
        <div className="flex gap-2">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/admin/dishes?status=${s}`}
              aria-current={s === status ? "page" : undefined}
              className={cn("inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold capitalize", s === status ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white")}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>
      {(dishes ?? []).length === 0 ? (
        <EmptyState title="No dishes here" action={<ButtonLink href="/admin/dishes/new">Create a dish</ButtonLink>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {(dishes ?? []).map((d) => (
            <li key={d.id}>
              <Link href={`/admin/dishes/${d.id}`} className="block h-full rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm hover:border-brand-200">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold text-ink">{d.name}</p>
                  <span className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
                    <Heart className="size-3.5" aria-hidden="true" />
                    {favorites.get(d.id) ?? 0}
                    <span className="sr-only"> favorites</span>
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge>{COURSE_LABELS[d.category] ?? d.category}</Badge>
                  {d.kosher_type ? <Badge>{d.kosher_type[0].toUpperCase() + d.kosher_type.slice(1)}</Badge> : null}
                </div>
                <div className="mt-2">
                  {allergens.get(d.id)?.length ? (
                    <AllergenBadges codes={allergens.get(d.id)!} />
                  ) : d.ingredients[0]?.count ? (
                    <p className="text-xs text-muted">No allergens in listed ingredients.</p>
                  ) : (
                    <Badge tone="amber">No ingredients yet</Badge>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
