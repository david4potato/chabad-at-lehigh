import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { RemoveDemoButton } from "@/components/admin/remove-demo-button";

type Step = { label: string; href?: string; done: boolean; action?: React.ReactNode };

/** Launch checklist for admins. Hidden once every step is done. */
export async function GettingStarted() {
  const supabase = await createClient();
  const [admins, pendingAdmins, org, demoEvents, demoDishes, dishes, events] = await Promise.all([
    supabase.from("user_roles").select("user_id", { count: "exact", head: true }).eq("role", "admin"),
    supabase.from("pending_role_grants").select("email", { count: "exact", head: true }).eq("role", "admin"),
    supabase.from("app_settings").select("updated_by").eq("key", "organization").maybeSingle(),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabase.from("dishes").select("id", { count: "exact", head: true }).eq("is_demo", true),
    supabase.from("dishes").select("id", { count: "exact", head: true }).eq("is_demo", false),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("is_demo", false).eq("status", "published"),
  ]);
  const hasDemo = (demoEvents.count ?? 0) + (demoDishes.count ?? 0) > 0;

  const steps: Step[] = [
    {
      label: `Give admin access to at least one more trusted person (e.g. ${SITE.adminExample})`,
      href: "/admin/people",
      done: (admins.count ?? 0) + (pendingAdmins.count ?? 0) >= 2,
    },
    { label: "Check the contact details and parking", href: "/admin/settings", done: Boolean(org.data?.updated_by) },
    ...(hasDemo ? [{ label: "Remove the [DEMO] events and dishes", done: false, action: <RemoveDemoButton /> }] : []),
    { label: "Add your ingredients and dishes", href: "/admin/ingredients", done: (dishes.count ?? 0) > 0 },
    { label: "Create and publish your first event", href: "/admin/events/new", done: (events.count ?? 0) > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  return (
    <Card className="border-gold-200">
      <div className="flex items-baseline justify-between gap-3">
        <CardTitle>Getting started</CardTitle>
        <p className="text-sm text-muted">
          {doneCount} of {steps.length} done
        </p>
      </div>
      <ul className="mt-3 space-y-1">
        {steps.map((s) => (
          <li key={s.label} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-2">
            {s.done ? (
              <CheckCircle2 className="size-5 shrink-0 text-green-700" aria-hidden="true" />
            ) : (
              <Circle className="size-5 shrink-0 text-stone-400" aria-hidden="true" />
            )}
            <span className="sr-only">{s.done ? "Done:" : "To do:"}</span>
            {s.href && !s.done ? (
              <Link href={s.href} className="min-w-0 flex-1 font-semibold text-brand-700 hover:underline">
                {s.label}
              </Link>
            ) : (
              <span className={s.done ? "min-w-0 flex-1 text-muted line-through" : "min-w-0 flex-1 font-semibold text-ink"}>{s.label}</span>
            )}
            {s.action}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">
        Before announcing the site, walk through{" "}
        <Link href="/admin/help#menus" className="font-semibold text-brand-700 hover:underline">
          menus and allergens
        </Link>{" "}
        with whoever cooks.
      </p>
    </Card>
  );
}
