import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOrgSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole(["admin"], "/admin/settings");
  const supabase = await createClient();
  const [org, { data }] = await Promise.all([
    getOrgSettings(),
    supabase.from("app_settings").select("value").eq("key", "student_email_domains").maybeSingle(),
  ]);
  const domains = Array.isArray(data?.value) ? (data.value as string[]) : ["lehigh.edu"];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" description="Contact details, address and who counts as a student." />
      <SettingsForm org={org} domains={domains} />
    </div>
  );
}
