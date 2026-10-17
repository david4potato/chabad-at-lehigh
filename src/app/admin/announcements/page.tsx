import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
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

export default async function AdminAnnouncementsPage() {
  await requireRole(["organizer", "admin"], "/admin/announcements");
  const supabase = await createClient();
  const [{ data: rows }, { data: events }] = await Promise.all([
    supabase
      .from("announcements")
      .select("id, title, body, audience, status, is_pinned, is_urgent, publish_at, expires_at, event_id")
      .order("publish_at", { ascending: false })
      .limit(100),
    supabase.from("events").select("id, title").neq("status", "draft").order("starts_at", { ascending: false }).limit(50),
  ]);
  const now = new Date().getTime();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Announcements" description="Shown on the home page and the Announcements page." />
      <Card>
        <CardTitle>New announcement</CardTitle>
        <div className="mt-4">
          <AnnouncementForm events={events ?? []} />
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
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4">
                <Badge tone={s.tone}>{s.label}</Badge>
                {a.is_pinned ? <Badge tone="gold">Pinned</Badge> : null}
                {a.is_urgent ? <Badge tone="amber">Important</Badge> : null}
                <span className="font-semibold text-ink">{a.title}</span>
                <span className="ml-auto text-xs text-muted">{formatDateTime(a.publish_at)}</span>
              </summary>
              <div className="border-t border-stone-100 p-4">
                <AnnouncementForm announcement={a} events={events ?? []} />
              </div>
            </details>
          );
        })}
        {(rows ?? []).length === 0 ? <p className="text-sm text-muted">No announcements yet.</p> : null}
      </section>
    </div>
  );
}
