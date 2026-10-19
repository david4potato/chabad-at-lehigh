import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { AllergenBadges } from "@/components/menu/allergen-badges";
import { IngredientForm } from "@/components/admin/menu/library-forms";

export const metadata: Metadata = { title: "Ingredients" };

const LIMIT = 300;

export default async function IngredientsPage({ searchParams }: PageProps<"/admin/ingredients">) {
  await requireRole(["organizer", "kitchen_staff", "admin"], "/admin/ingredients");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : "";
  const supabase = await createClient();
  let query = supabase.from("ingredients").select("id, name, notes, allergens:ingredient_allergens(allergen_code)").order("name").limit(LIMIT);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const { data } = await query;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Ingredients"
        description="Mark every allergen an ingredient contains, using the package label."
        actions={<Link href="/admin/dishes" className="text-sm font-semibold text-brand-700 hover:underline">← Dishes</Link>}
      />
      <Card>
        <CardTitle>Add an ingredient</CardTitle>
        <div className="mt-4">
          <IngredientForm />
        </div>
      </Card>
      <form role="search">
        <Input name="q" defaultValue={q} placeholder="Search ingredients" aria-label="Search ingredients" />
      </form>
      <ul className="space-y-2">
        {(data ?? []).map((i) => {
          const codes = i.allergens.map((a) => a.allergen_code);
          return (
            <li key={i.id}>
              <details className="rounded-2xl border border-stone-200 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-3.5">
                  <span className="font-semibold text-ink">{i.name}</span>
                  {codes.length ? <AllergenBadges codes={codes} label={null} /> : <span className="text-xs text-muted">No allergens</span>}
                </summary>
                <div className="border-t border-stone-100 p-4">
                  <IngredientForm ingredient={{ id: i.id, name: i.name, notes: i.notes, allergens: codes }} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
      {(data ?? []).length === LIMIT ? (
        <p className="text-sm text-muted">Showing the first {LIMIT}, A to Z. Search to find others.</p>
      ) : null}
    </div>
  );
}
