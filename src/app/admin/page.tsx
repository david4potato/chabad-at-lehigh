import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarPlus, ChefHat, Lightbulb, Megaphone, UserCheck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { canManageEvents, canManageMenus, isAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate, formatTime } from "@/lib/time";
import { getEventCounts } from "@/lib/data/events";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { GettingStarted } from "@/components/admin/getting-started";

export const metadata: Metadata = { title: "Overview" };

function since() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
}

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const viewer = await requireRole(["organizer", "kitchen_staff", "admin"], "/admin");
  const params = await searchParams;
  const organizer = canManageEvents(viewer.roles);
  const menus = canManageMenus(viewer.roles);
  const supabase = await createClient();

  const [{ data: events }, { data: published }, suggestions] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, capacity, status, has_meal")
      .neq("status", "draft")
      .gte("starts_at", since())
      .order("starts_at")
      .limit(5),
    // Approvals are counted across every upcoming event, not just the five listed.
    organizer
      ? supabase.from("events").select("id").eq("status", "published").gte("starts_at", since()).limit(500)
      : Promise.resolve({ data: [] as { id: string }[] }),
    menus
      ? supabase.from("dish_suggestions").select("id", { count: "exact", head: true }).eq("status", "new")
      : Promise.resolve({ count: 0 }),
  ]);
  const upcoming = events ?? [];
  const pendingIds = (published ?? []).map((e) => e.id);
  const counts = await getEventCounts([...new Set([...upcoming.map((e) => e.id), ...pendingIds])]);
  const pendingTotal = pendingIds.reduce((sum, id) => sum + (counts.get(id)?.pending ?? 0), 0);
  const newSuggestions = suggestions.count ?? 0;

  return (
    <div className="space-y-6">
      {params.notice === "demo-removed" ? <Alert tone="success">Demo content removed.</Alert> : null}
      {params.denied ? (
        <Alert tone="warning">That page needs a different role. Ask an admin (People &amp; roles) if you need access.</Alert>
      ) : null}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Hi, {viewer.displayName}</h1>
        <p className="mt-1 text-muted">
          Here&apos;s what&apos;s coming up. New to the dashboard?{" "}
          <Link href="/admin/help" className="font-semibold text-brand-700 hover:underline">
            Read the quick guide
          </Link>
          .
        </p>
      </div>

      {isAdmin(viewer.roles) ? <GettingStarted /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {organizer ? (
          <StatCard href="/admin/events" Icon={UserCheck} label="RSVPs needing approval" value={pendingTotal} highlight={pendingTotal > 0} />
        ) : null}
        {menus ? (
          <StatCard href="/admin/suggestions" Icon={Lightbulb} label="New menu suggestions" value={newSuggestions} highlight={newSuggestions > 0} />
        ) : null}
        {organizer ? <QuickAction href="/admin/events/new" Icon={CalendarPlus} label="New event" /> : null}
        {organizer ? <QuickAction href="/admin/announcements" Icon={Megaphone} label="New announcement" /> : null}
        {menus ? <QuickAction href="/admin/dishes" Icon={ChefHat} label="Dishes & ingredients" /> : null}
      </div>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Upcoming events</CardTitle>
          <Link href="/admin/events" className="text-sm font-semibold text-brand-700 hover:underline">
            All events
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Nothing scheduled" action={organizer ? <ButtonLink href="/admin/events/new">Create an event</ButtonLink> : undefined} />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-stone-100">
            {upcoming.map((e) => {
              const c = counts.get(e.id);
              return (
                <li key={e.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-ink">{e.title}</p>
                    <p className="text-sm text-muted">
                      {formatShortDate(e.starts_at)} · {formatTime(e.starts_at)} · {c?.seatsTaken ?? 0}
                      {e.capacity ? ` / ${e.capacity}` : ""} seats
                      {c?.waitlist ? ` · ${c.waitlist} waitlist` : ""}
                      {c?.pending ? <span className="font-semibold text-brand-800"> · {c.pending} need approval</span> : null}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {organizer ? <ButtonLink href={`/admin/events/${e.id}/attendees`} size="sm">Attendees</ButtonLink> : null}
                    {menus && e.has_meal ? (
                      <ButtonLink href={`/admin/events/${e.id}/menu`} size="sm" variant="secondary">Menu</ButtonLink>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({ href, Icon, label, value, highlight }: { href: string; Icon: typeof UserCheck; label: string; value: number; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-[var(--radius-card)] border p-4 shadow-sm transition hover:shadow-md ${highlight ? "border-brand-300 bg-brand-50" : "border-stone-200 bg-white"}`}
    >
      <Icon className="size-6 text-brand-700" aria-hidden="true" />
      <div>
        <p className="text-2xl font-extrabold text-ink">{value}</p>
        <p className="text-sm text-muted">{label}</p>
      </div>
    </Link>
  );
}

function QuickAction({ href, Icon, label }: { href: string; Icon: typeof UserCheck; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 font-semibold text-ink shadow-sm hover:shadow-md">
      <Icon className="size-6 text-gold-700" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <ArrowRight className="size-4 text-muted" aria-hidden="true" />
    </Link>
  );
}
