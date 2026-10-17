import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { canManageEvents } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getAdminEvent } from "@/lib/data/admin";
import { groupByCourse, parseEventMenu } from "@/lib/menu";
import { formatDateTime, formatLongDate } from "@/lib/time";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EventTabs } from "@/components/admin/event-tabs";
import { AdminEventHeader } from "@/components/admin/event-header";
import {
  AddDishForm,
  DraftDetailsForm,
  MenuItemEditor,
  MenuUpdateForm,
  PublishForm,
  StartDraftButton,
  VotingOptions,
} from "@/components/admin/menu/menu-editor";

export const metadata: Metadata = { title: "Menu" };

const STATUS_TONE = { draft: "brand", published: "green", archived: "neutral" } as const;

const NOTICES: Record<string, string> = {
  started: "Draft started. Changes stay private until you publish.",
  discarded: "Draft discarded. The published menu (if any) is unchanged.",
  published: "Menu published.",
  published_urgent: "Menu published, and everyone who RSVP'd was notified.",
};

export default async function MenuAdminPage({ params, searchParams }: PageProps<"/admin/events/[id]/menu">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const notice = typeof query.notice === "string" ? NOTICES[query.notice] : undefined;
  const viewer = await requireRole(["organizer", "kitchen_staff", "admin"], `/admin/events/${id}/menu`);
  const event = await getAdminEvent(id);
  const supabase = await createClient();

  const [{ data: versions }, { data: dishes }, menuRes, { data: options }, { data: votes }, { data: updates }] = await Promise.all([
    supabase
      .from("menu_versions")
      .select("id, version, status, title, change_summary, published_at, prep_confirmed_at, created_at")
      .eq("event_id", event.id)
      .order("version", { ascending: false }),
    supabase.from("dishes").select("id, name, category, status").neq("status", "archived").order("name"),
    supabase.rpc("get_event_menu", { p_event_id: event.id, p_include_draft: true }),
    supabase.from("event_menu_options").select("dish_id, dish:dishes(name)").eq("event_id", event.id),
    supabase.rpc("get_dish_vote_counts", { p_event_id: event.id }),
    supabase.from("menu_updates").select("id, message, is_urgent, created_at").eq("event_id", event.id).order("created_at", { ascending: false }).limit(10),
  ]);

  const all = versions ?? [];
  const draft = all.find((v) => v.status === "draft") ?? null;
  const published = all.find((v) => v.status === "published") ?? null;
  const menu = parseEventMenu(menuRes.data);
  const draftItems = draft && menu?.version?.id === draft.id ? menu.items : [];
  const voteMap = new Map((votes ?? []).map((v) => [v.dish_id, v.votes]));
  const optionRows = (options ?? [])
    .map((o) => ({ dish_id: o.dish_id, name: o.dish?.name ?? "Unknown dish", votes: voteMap.get(o.dish_id) ?? 0 }))
    .sort((a, b) => b.votes - a.votes);

  return (
    <div className="space-y-6">
      <div>
        <AdminEventHeader event={event} />
        <EventTabs eventId={event.id} active="menu" roles={viewer.roles} />
      </div>
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {!event.has_meal ? (
        <Alert tone="info">This event isn&apos;t marked as having a meal, so the menu won&apos;t show on the event page. Turn on &ldquo;This event has a meal&rdquo; in Details.</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          <Card>
            <CardTitle>{draft ? `Draft — version ${draft.version}` : "Menu"}</CardTitle>
            {published ? (
              <p className="mt-1 text-sm text-muted">
                Live now: version {published.version}, published {formatLongDate(published.published_at!)}.
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">Nothing is published yet. People see &ldquo;Menu coming soon&rdquo;.</p>
            )}
            {!draft ? (
              <div className="mt-4">
                <StartDraftButton eventId={event.id} hasPublished={Boolean(published)} />
              </div>
            ) : (
              <div className="mt-5 space-y-6">
                <DraftDetailsForm eventId={event.id} versionId={draft.id} title={draft.title} kitchenNotes={menu?.version?.kitchen_notes ?? null} />
                <div className="space-y-4">
                  <h3 className="text-base font-bold text-ink">Dishes</h3>
                  {draftItems.length === 0 ? <p className="text-sm text-muted">No dishes yet — add one below.</p> : null}
                  {groupByCourse(draftItems).map((g) => (
                    <div key={g.course}>
                      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{g.label}</p>
                      <ul className="space-y-2">
                        {g.items.map((item) => (
                          <MenuItemEditor key={item.id} eventId={event.id} item={item} />
                        ))}
                      </ul>
                    </div>
                  ))}
                  <AddDishForm eventId={event.id} versionId={draft.id} dishes={dishes ?? []} />
                </div>
              </div>
            )}
          </Card>

          {draft ? (
            <Card className="border-gold-200">
              <CardTitle>Publish</CardTitle>
              <p className="mt-1 text-sm text-muted">Publishing makes this version visible to everyone and freezes it.</p>
              <div className="mt-4">
                <PublishForm eventId={event.id} versionId={draft.id} hasPublished={Boolean(published)} itemCount={draftItems.length} />
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardTitle>Post a menu update</CardTitle>
            <p className="mt-1 text-sm text-muted">Quick notices without a new version. Shown on the event page.</p>
            <div className="mt-4">
              <MenuUpdateForm eventId={event.id} versionId={published?.id ?? null} />
            </div>
            {(updates ?? []).length ? (
              <ul className="mt-5 space-y-2 border-t border-stone-100 pt-4 text-sm">
                {(updates ?? []).map((u) => (
                  <li key={u.id}>
                    {u.is_urgent ? <Badge tone="amber" className="mr-1">Urgent</Badge> : null}
                    <span className="text-ink">{u.message}</span>
                    <span className="block text-xs text-muted">{formatDateTime(u.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </Card>

          <Card>
            <CardTitle>Menu voting</CardTitle>
            <p className="mt-1 text-sm text-muted">Advisory only — you choose the final menu. Votes never mean a dish suits an allergy.</p>
            <div className="mt-4">
              <VotingOptions
                eventId={event.id}
                open={event.menu_voting_open}
                canToggle={canManageEvents(viewer.roles)}
                options={optionRows}
                dishes={dishes ?? []}
              />
            </div>
          </Card>

          <Card>
            <CardTitle>Version history</CardTitle>
            {all.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No versions yet.</p>
            ) : (
              <ul className="mt-3 space-y-3 text-sm">
                {all.map((v) => (
                  <li key={v.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">Version {v.version}</span>
                      <Badge tone={STATUS_TONE[v.status]}>{v.status}</Badge>
                    </div>
                    <p className="text-muted">
                      {v.published_at ? `Published ${formatDateTime(v.published_at)}` : `Started ${formatDateTime(v.created_at)}`}
                    </p>
                    {v.change_summary ? <p className="text-ink">{v.change_summary}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
