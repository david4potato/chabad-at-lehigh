import type { Metadata } from "next";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";
import type { Severity } from "@/lib/allergens";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { DietaryForm } from "@/components/account/dietary-form";
import { DietaryPrivacyCard } from "@/components/account/privacy-card";

export const metadata: Metadata = { title: "Dietary & allergies" };

export default async function DietaryPage({ searchParams }: PageProps<"/profile/dietary">) {
  const params = await searchParams;
  const viewer = await requireViewer("/profile/dietary");
  const welcome = params.welcome === "1";
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, welcome ? "/" : "/profile");

  const supabase = await createClient();
  const [{ data: profile }, { data: allergens }] = await Promise.all([
    supabase
      .from("dietary_profiles")
      .select("diets, other_restrictions, notes_for_kitchen, carries_epinephrine, share_with_kitchen")
      .eq("user_id", viewer.id)
      .maybeSingle(),
    supabase.from("user_allergens").select("allergen_code, severity, notes").eq("user_id", viewer.id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {welcome ? (
        <div>
          <p className="text-sm font-semibold text-gold-700">Step 2 of 2 · optional</p>
          <h1 className="text-3xl font-extrabold tracking-tight lg:text-[2.5rem] lg:leading-tight">Any food allergies or dietary needs?</h1>
          <p className="mt-2 text-muted">
            Recommended if you&apos;ll come to meals. You&apos;ll also get personal alerts on menus. You can skip this and
            add it later.
          </p>
          <a href={next} className="mt-2 inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
            No allergies or dietary needs? Skip for now
          </a>
        </div>
      ) : (
        <PageHeader
          title="Dietary & allergies"
          description="Helps our kitchen plan, and shows you personal alerts on menus. Menus are never a guarantee — contact the organizer about serious allergies."
        />
      )}
      <DietaryPrivacyCard />
      <Card>
        <DietaryForm
          welcome={welcome}
          next={next}
          initial={{
            allergens: (allergens ?? []).map((a) => ({ code: a.allergen_code, severity: a.severity as Severity, notes: a.notes })),
            diets: profile?.diets ?? [],
            other_restrictions: profile?.other_restrictions ?? null,
            notes_for_kitchen: profile?.notes_for_kitchen ?? null,
            carries_epinephrine: profile?.carries_epinephrine ?? false,
            share_with_kitchen: profile?.share_with_kitchen ?? true,
            hasData: Boolean(profile) || (allergens ?? []).length > 0,
          }}
        />
      </Card>
    </div>
  );
}
