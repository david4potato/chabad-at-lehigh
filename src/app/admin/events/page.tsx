import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { canManageEvents, canManageMenus } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate, formatTime } from "@/lib/time";
import { getEventCounts } from "@/lib/data/events";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { CATEGORY_LABELS } from "@/components/events/event-utils";

export const metadata: Metadata = { title: "Events" };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "drafts", label: "Drafts" },
  { key: "past", label: "Past" },
] as const;
const STATUS_TONE = { draft: "neutral", published: "green", cancelled: "red" } as const;

function cutoff() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
}

export default async function AdminEventsPage({ searchParams }: PageProps<"/admin/events">) {
  const viewer = await requireRole(["organizer", "kitchen_staff", "admin"], "/admin/events");
  const params = await searchParams;
  const tab = TABS.some((t) => t.key === params.tab) ? (params.tab as (typeof TABS)[number]["key"]) : "upcoming";
  const organizer = canManageEvents(viewer.roles);
  const menus = canManageMenus(viewer.roles);

  const supabase = await createClient();
  let query = supabase
    .from("events")
    .select("id, slug, title, status, category, starts_at, ends_at, capacity, has_meal")
    .limit(100);
  const since = cutoff();
  if (tab === "drafts") query = query.eq("status", "draft").order("starts_at");
  else if (tab === "past") query = query.neq("status", "draft").lt("starts_at", since).order("starts_at", { ascending: false });
  else query = query.neq("status", "draft").gte("starts_at", since).order("starts_at");
  const { data } = await query;
  const events = data ?? [];
  const counts = await getEventCounts(events.map((e) => e.id));

  return (
    <div>
      <PageHeader
        title="Events"
        description={organizer ? "Create events, manage RSVPs and menus." : "Open an event to plan its menu."}
        actions={
          organizer ? (
            <ButtonLink href="/admin/events/new">
              <Plus className="size-4" aria-hidden="true" /> New event
            </ButtonLink>
          ) : undefined
        }
      />
      {params.deleted ? <Alert tone="success" className="mb-4">Event deleted.</Alert> : null}

      <nav aria-label="Event lists" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/events?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold",
              tab === t.key ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-ink hover:bg-stone-50",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {events.length === 0 ? (
        <EmptyState
          title={tab === "drafts" ? "No drafts" : tab === "past" ? "No past events yet" : "No upcoming events"}
          action={organizer && tab !== "past" ? <ButtonLink href="/admin/events/new">Create an event</ButtonLink> : undefined}
        />
      ) : (
        <ul className="space-y-3">
          {events.map((e) => {
            const c = counts.get(e.id);
            return (
              <li key={e.id} className="rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_TONE[e.status]}>{e.status[0].toUpperCase() + e.status.slice(1)}</Badge>
                      <span className="text-xs font-semibold text-muted">{CATEGORY_LABELS[e.category]}</span>
                    </div>
                    <p className="mt-1 font-bold text-ink">{e.title}</p>
                    <p className="text-sm text-muted">
                      {formatShortDate(e.starts_at)} · {formatTime(e.starts_at)}
                      {c ? (
                        <>
                          {" · "}
                          <span className="font-semibold text-ink">
                            {c.seatsTaken}
                            {e.capacity ? ` / ${e.capacity}` : ""} seats
                          </span>
                          {c.waitlist ? ` · ${c.waitlist} waitlist` : ""}
                          {c.pending ? <span className="font-semibold text-brand-800"> · {c.pending} need approval</span> : ""}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {organizer ? (
                      <>
                        <ButtonLink href={`/admin/events/${e.id}/attendees`} size="sm">Attendees</ButtonLink>
                        <ButtonLink href={`/admin/events/${e.id}`} size="sm" variant="secondary">Edit</ButtonLink>
                      </>
                    ) : null}
                    {menus && e.has_meal ? (
                      <ButtonLink href={`/admin/events/${e.id}/menu`} size="sm" variant="secondary">Menu</ButtonLink>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
