import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/safe-redirect";
import { Card } from "@/components/ui/card";
import { ProfileForm } from "@/components/account/profile-form";
import { completeWelcome } from "@/app/profile/actions";

export const metadata: Metadata = { title: "Welcome" };

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : null, "/");
  const viewer = await requireViewer("/welcome");
  if (viewer.onboarded) redirect(next);

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, preferred_name, affiliation, class_year, phone")
    .eq("id", viewer.id)
    .single();

  return (
    <div className="mx-auto max-w-xl py-2 sm:py-6">
      <div className="mb-6">
        <p className="text-sm font-semibold text-gold-700">Step 1 of 2</p>
        <h1 className="text-3xl font-extrabold tracking-tight">Welcome to Chabad at Lehigh!</h1>
        <p className="mt-2 text-muted">
          Just your name and you&apos;re in. Your email ({viewer.email}) is only used to sign in and for event updates.
        </p>
      </div>
      <Card>
        <ProfileForm
          action={completeWelcome}
          profile={profile ?? { full_name: null, preferred_name: null, affiliation: viewer.affiliation, class_year: null, phone: null }}
          submitLabel="Continue"
          next={next}
          compact
        />
      </Card>
    </div>
  );
}
