import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Bell, LayoutDashboard, LogOut, Salad, Ticket } from "lucide-react";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getOrgSettings } from "@/lib/settings";
import { ROLE_LABELS, isStaff } from "@/lib/roles";
import { parseMyStats } from "@/lib/stats";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ProfileForm } from "@/components/account/profile-form";
import { DeleteAccount } from "@/components/account/delete-account";
import { ActivityCard } from "@/components/account/activity-card";
import { saveProfile } from "./actions";

export const metadata: Metadata = { title: "Profile & settings" };

export default async function ProfilePage() {
  const viewer = await requireViewer("/profile");
  const supabase = await createClient();
  const [{ data: profile }, org, myStats] = await Promise.all([
    supabase.from("profiles").select("full_name, preferred_name, affiliation, class_year, phone").eq("id", viewer.id).single(),
    getOrgSettings(),
    supabase.rpc("get_my_stats"),
  ]);
  // The numbers are a nice extra: if they fail to load, the rest of the page still works.
  const activity = myStats.error ? null : parseMyStats(myStats.data);

  const links = [
    { href: "/profile/dietary", label: "Dietary & allergies", hint: viewer.hasDietaryInfo ? "Saved — private" : "Not added yet", Icon: Salad },
    {
      href: "/notifications",
      label: "Notifications",
      hint: viewer.unreadNotifications > 0 ? `${viewer.unreadNotifications} unread` : "You're all caught up",
      Icon: Bell,
    },
    { href: "/my-events", label: "My events", hint: "Your RSVPs", Icon: Ticket },
    ...(isStaff(viewer.roles) ? [{ href: "/admin", label: "Dashboard", hint: "Events, menus, RSVPs", Icon: LayoutDashboard }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Profile & settings" title={`Hi, ${viewer.displayName}`} description={`Signed in as ${viewer.email}`} />

      <div className="flex flex-wrap gap-2">
        {viewer.roles.map((r) => (
          <Badge key={r} tone={r === "student" || r === "community_guest" ? "neutral" : "brand"}>
            {ROLE_LABELS[r]}
          </Badge>
        ))}
      </div>

      {activity ? <ActivityCard stats={activity} /> : null}

      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map(({ href, label, hint, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm hover:border-brand-200"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-ink">{label}</span>
                <span className="block text-sm text-muted">{hint}</span>
              </span>
              <ArrowRight className="size-4 text-muted" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>

      <Card>
        <CardTitle>Your details</CardTitle>
        <p className="mt-1 text-sm text-muted">
          Your sign-in email can&apos;t be changed here. Need a different one?{" "}
          {org.contact_email ? (
            <>
              Email us at{" "}
              <a href={`mailto:${org.contact_email}`} className="break-all font-semibold text-brand-700 hover:underline">
                {org.contact_email}
              </a>
              .
            </>
          ) : (
            <>
              <Link href="/find-us" className="font-semibold text-brand-700 hover:underline">
                Get in touch
              </Link>
              .
            </>
          )}
        </p>
        <div className="mt-5">
          <ProfileForm
            action={saveProfile}
            profile={profile ?? { full_name: null, preferred_name: null, affiliation: viewer.affiliation, class_year: null, phone: null }}
            submitLabel="Save changes"
          />
        </div>
      </Card>

      <Card>
        <CardTitle>Privacy</CardTitle>
        <p className="mt-1 text-sm text-muted">
          See exactly who can see what on our{" "}
          <Link href="/privacy" className="font-semibold text-brand-700 hover:underline">
            privacy page
          </Link>
          . Your dietary information is private and you can delete it any time.
        </p>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <form action="/auth/sign-out" method="post">
          <Button type="submit" variant="secondary" className="w-full sm:w-auto">
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </Button>
        </form>
        <form action="/auth/sign-out" method="post">
          <input type="hidden" name="everywhere" value="1" />
          <Button type="submit" variant="ghost" className="w-full sm:w-auto">
            Sign out on all devices
          </Button>
        </form>
      </div>

      <section aria-labelledby="delete-heading" className="border-t border-stone-200 pt-6">
        <h2 id="delete-heading" className="text-base font-bold text-ink">
          Delete account
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted">Remove your account and everything tied to it.</p>
        <DeleteAccount />
      </section>
    </div>
  );
}
