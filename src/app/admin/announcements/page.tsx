import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime, formatShortDateMaybeYear } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AnnouncementForm } from "@/components/admin/announcement-form";

export const metadata: Metadata = { title: "Announcements" };

function stateOf(a: { status: string; publish_at: string; expires_at: string | null }, now: number) {
  if (a.status === "draft") return { label: "Draft", tone: "neutral" as const };
  if (new Date(a.publish_at).getTime() > now) return { label: "Scheduled", tone: "brand" as const };
  if (a.expires_at && new Date(a.expires_at).getTime() <= now) return { label: "Expired", tone: "neutral" as const };
  return { label: "Live", tone: "green" as const };
}

const LIMIT = 100;

type EventChoice = { id: string; title: string; starts_at: string; status: string };

// Weekly dinners share a title, so each choice shows its date (and whether it's cancelled).
function eventOption(ev: EventChoice) {
  const note = ev.status === "cancelled" ? " (cancelled)" : ev.status === "draft" ? " (draft)" : "";
  return { id: ev.id, label: `${formatShortDateMaybeYear(ev.starts_at)} · ${ev.title}${note}` };
}

export default async function AdminAnnouncementsPage() {
  await requireRole(["organizer", "admin"], "/admin/announcements");
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const eventColumns = "id, title, starts_at, status";
  const [{ data: rows }, { data: upcoming }, { data: past }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, audience, status, is_pinned, is_urgent, publish_at, expires_at, event_id")
      .order("publish_at", { ascending: false })
      .limit(LIMIT),
    // Upcoming events soonest first, then recent past ones.
    supabase.from("events").select(eventColumns).neq("status", "draft").gte("starts_at", nowIso).order("starts_at").limit(40),
    supabase
      .from("events")
      .select(eventColumns)
      .neq("status", "draft")
      .lt("starts_at", nowIso)
      .order("starts_at", { ascending: false })
      .limit(20),
  ]);
  const listed: EventChoice[] = [...(upcoming ?? []), ...(past ?? [])];
  // An announcement can link to an older event; load it too so saving keeps the link.
  const missing = [
    ...new Set((rows ?? []).map((a) => a.event_id).filter((id): id is string => !!id && !listed.some((e) => e.id === id))),
  ];
  const { data: linked } = missing.length
    ? await supabase.from("events").select(eventColumns).in("id", missing).order("starts_at", { ascending: false })
    : { data: [] as EventChoice[] };
  const events = [...listed, ...(linked ?? [])].map(eventOption);
  const now = new Date().getTime();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Announcements" description="Shown on the home page and the Announcements page." />
      <Card>
        <CardTitle>New announcement</CardTitle>
        <div className="mt-4">
          <AnnouncementForm events={events} />
        </div>
      </Card>
      <section aria-labelledby="existing-heading" className="space-y-3">
        <h2 id="existing-heading" className="text-sm font-bold uppercase tracking-wide text-muted">
          All announcements
        </h2>
        {(rows ?? []).map((a) => {
          const s = stateOf(a, now);
          return (
            <details key={a.id} className="group rounded-[var(--radius-card)] border border-stone-200 bg-white shadow-sm">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 [&::-webkit-details-marker]:hidden">
                <Badge tone={s.tone}>{s.label}</Badge>
                {a.is_pinned ? <Badge tone="gold">Pinned</Badge> : null}
                {a.is_urgent ? <Badge tone="amber">Important</Badge> : null}
                <span className="font-semibold wrap-anywhere text-ink">{a.title}</span>
                <span className="ml-auto flex items-center gap-3">
                  <span className="text-xs text-muted">{formatDateTime(a.publish_at)}</span>
                  <span className="text-sm font-semibold text-brand-700">Edit</span>
                </span>
              </summary>
              <div className="border-t border-stone-100 p-4">
                <AnnouncementForm announcement={a} events={events} />
              </div>
            </details>
          );
        })}
        {(rows ?? []).length === 0 ? <p className="text-sm text-muted">No announcements yet.</p> : null}
        {(rows ?? []).length === LIMIT ? <p className="text-sm text-muted">Showing the newest {LIMIT}.</p> : null}
      </section>
    </div>
  );
}
