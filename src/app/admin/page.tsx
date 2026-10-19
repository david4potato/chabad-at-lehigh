import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarPlus, ChefHat, Lightbulb, Megaphone, UserCheck } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { canManageEvents, canManageMenus, isAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate, formatTime } from "@/lib/time";
import { getEventCounts, upcomingFilter } from "@/lib/data/events";
import { formatSince, parseStaffStats, semesterStart } from "@/lib/stats";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { GettingStarted } from "@/components/admin/getting-started";
import { StatsRow } from "@/components/admin/stats-row";

export const metadata: Metadata = { title: "Overview" };

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const viewer = await requireRole(["organizer", "kitchen_staff", "admin"], "/admin");
  const params = await searchParams;
  const organizer = canManageEvents(viewer.roles);
  const menus = canManageMenus(viewer.roles);
  const supabase = await createClient();
  const semester = semesterStart();
  // Same "still on" rule as the public site: until it ends, or 3 hours after start without an end time.
  const stillOn = upcomingFilter();

  const [{ data: events }, { data: published }, suggestions, semesterStats] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, capacity, status, has_meal")
      .neq("status", "draft")
      .or(stillOn)
      .order("starts_at")
      .limit(5),
    // Approvals are counted across every upcoming event, not just the five listed.
    organizer
      ? supabase.from("events").select("id").eq("status", "published").or(stillOn).limit(500)
      : Promise.resolve({ data: [] as { id: string }[] }),
    menus
      ? supabase.from("dish_suggestions").select("id", { count: "exact", head: true }).eq("status", "new")
      : Promise.resolve({ count: 0 }),
    // A few numbers for organizers/admins; the SQL function checks the role too.
    organizer ? supabase.rpc("get_staff_stats", { p_since: semester }) : Promise.resolve(null),
  ]);
  const upcoming = events ?? [];
  const pendingIds = (published ?? []).map((e) => e.id);
  const counts = await getEventCounts([...new Set([...upcoming.map((e) => e.id), ...pendingIds])]);
  const pendingEvents = pendingIds.filter((id) => (counts.get(id)?.pending ?? 0) > 0);
  const pendingTotal = pendingEvents.reduce((sum, id) => sum + (counts.get(id)?.pending ?? 0), 0);
  // One event waiting? Go straight to its attendees (it opens on "Needs approval").
  const approvalsHref = pendingEvents.length === 1 ? `/admin/events/${pendingEvents[0]}/attendees` : "/admin/events";
  const newSuggestions = suggestions.count ?? 0;
  const showApprovals = organizer && pendingTotal > 0;
  const showSuggestions = menus && newSuggestions > 0;
  const staffStats = semesterStats && !semesterStats.error ? parseStaffStats(semesterStats.data) : null;

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

      {!showApprovals && !showSuggestions ? <p className="text-muted">Nothing needs your attention. Enjoy your day.</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {showApprovals ? (
          <StatCard href={approvalsHref} Icon={UserCheck} label={pendingTotal === 1 ? "RSVP to approve" : "RSVPs to approve"} value={pendingTotal} />
        ) : null}
        {showSuggestions ? (
          <StatCard
            href="/admin/suggestions"
            Icon={Lightbulb}
            label={newSuggestions === 1 ? "New menu suggestion" : "New menu suggestions"}
            value={newSuggestions}
          />
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
                    <p className="font-semibold text-ink">
                      {e.title}
                      {e.status === "cancelled" ? (
                        <Badge tone="red" className="ml-2 align-middle">
                          Cancelled
                        </Badge>
                      ) : null}
                    </p>
                    <p className="text-sm text-muted">
                      {formatShortDate(e.starts_at)} · {formatTime(e.starts_at)} · {c?.seatsTaken ?? 0}
                      {e.capacity ? ` / ${e.capacity}` : ""} {(e.capacity ?? c?.seatsTaken ?? 0) === 1 ? "seat" : "seats"}
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

      {staffStats ? <StatsRow stats={staffStats} since={formatSince(semester)} /> : null}
    </div>
  );
}

/** Something waiting for the viewer. Only shown when there is something to do. */
function StatCard({ href, Icon, label, value }: { href: string; Icon: typeof UserCheck; label: string; value: number }) {
  return (
    <Link href={href} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-brand-300 bg-brand-50 p-4 shadow-sm transition hover:shadow-md">
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
