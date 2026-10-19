import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Audit log" };

// Plain-language names for the most common entries (falls back to the raw action).
const ACTION_LABELS: Record<string, string> = {
  "dietary_report.viewed": "Dietary report viewed",
  "menu.published": "Menu published",
  "menu_update.urgent": "Urgent menu update posted",
  "menu_update.posted": "Menu update posted",
  "user_roles.insert": "Role given",
  "user_roles.delete": "Role removed",
  "pending_role_grants.insert": "Role saved for first sign-in",
  "pending_role_grants.delete": "Pending role removed",
  "events.insert": "Event created",
  "events.update": "Event changed",
  "events.delete": "Event deleted",
  "rsvp.approve": "RSVP approved",
  "rsvp.decline": "RSVP declined",
  "rsvp.guests_approve": "Guests approved",
  "rsvp.guests_decline": "Guests declined",
  "rsvp.staff_cancel": "RSVP cancelled by staff",
  "event.invites_sent": "Invitations sent",
  "menu_versions.insert": "Menu draft started",
  "menu_versions.update": "Menu version changed",
  "menu_versions.delete": "Menu version deleted",
  "menu_items.insert": "Dish added to menu",
  "menu_items.update": "Menu dish changed",
  "menu_items.delete": "Dish removed from menu",
  "announcements.insert": "Announcement posted",
  "announcements.update": "Announcement changed",
  "announcements.delete": "Announcement deleted",
  "app_settings.insert": "Settings changed",
  "app_settings.update": "Settings changed",
  "account.deleted": "Account deleted",
  "demo.removed": "Demo content removed",
};

// Filter chips. Most match entity_type; "dietary" picks out views of the named dietary report.
const FILTERS = [
  { value: "dietary", label: "dietary report views" },
  ...["events", "menu_versions", "menu_updates", "rsvps", "user_roles", "pending_role_grants", "announcements", "app_settings"].map((t) => ({
    value: t,
    label: t.replace(/_/g, " "),
  })),
  { value: "profiles", label: "account deletions" },
];

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireRole(["admin"], "/admin/audit");
  const params = await searchParams;
  const type = FILTERS.find((f) => f.value === params.type)?.value ?? null;
  const supabase = await createClient();
  let query = supabase
    .from("audit_events")
    .select("id, action, entity_type, entity_id, details, created_at, actor_ref, actor:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (type === "dietary") query = query.eq("action", "dietary_report.viewed");
  else if (type) query = query.eq("entity_type", type);
  const { data } = await query;
  const rows = data ?? [];

  // Event titles for event rows (deleted events fall back to the id), and who got or lost
  // a role (user_roles rows store the person's id; pending grants store the email).
  // One query each, run together.
  const eventIds = [...new Set(rows.filter((r) => r.entity_type === "events" && r.entity_id).map((r) => r.entity_id!))];
  const personIds = [...new Set(rows.filter((r) => r.entity_type === "user_roles" && r.entity_id).map((r) => r.entity_id!))];
  const [{ data: events }, { data: people }] = await Promise.all([
    eventIds.length
      ? supabase.from("events").select("id, title").in("id", eventIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    personIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", personIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
  ]);
  const titles = new Map((events ?? []).map((e) => [e.id, e.title]));
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));

  const subjectOf = (entityType: string, entityId: string | null) => {
    if (!entityId) return undefined;
    if (entityType === "events") return titles.get(entityId);
    if (entityType === "user_roles") return names.get(entityId) ?? `Deleted account ${entityId.slice(0, 8)}…`;
    if (entityType === "pending_role_grants") return entityId;
    return undefined;
  };
  const chip = (active: boolean) =>
    cn("inline-flex h-11 items-center rounded-full border px-4 text-xs font-semibold whitespace-nowrap", active ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-ink");

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="An append-only record of important changes, including every view of the named dietary report. Newest 200 shown."
      />
      <nav aria-label="Filter by type" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          <Link href="/admin/audit" className={chip(!type)}>All</Link>
          {FILTERS.map((f) => (
            <Link key={f.value} href={`/admin/audit?type=${f.value}`} className={chip(type === f.value)}>
              {f.label}
            </Link>
          ))}
        </div>
      </nav>
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-stone-100">
          {rows.map((row) => {
            const subject = subjectOf(row.entity_type, row.entity_id);
            const { role, ...otherDetails } = (row.details ?? {}) as Record<string, unknown>;
            const roleLabel = typeof role === "string" ? (ROLE_LABELS[role as Role] ?? role) : null;
            const extra = roleLabel ? otherDetails : ((row.details ?? {}) as Record<string, unknown>);
            return (
              <li key={row.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[170px_1fr_1.2fr] sm:gap-4">
                <span className="text-muted">{formatDateTime(row.created_at)}</span>
                <span>
                  <span className="font-semibold text-ink">{ACTION_LABELS[row.action] ?? row.action}</span>
                  <span className="block text-xs text-muted">
                    {/* actor_ref keeps the id after the person deletes their account. */}
                    {row.actor?.full_name || row.actor?.email || (row.actor_ref ? `Deleted account ${row.actor_ref.slice(0, 8)}…` : "System")}
                  </span>
                </span>
                <span className="text-xs text-muted">
                  {subject || roleLabel ? (
                    <span className="block break-all font-semibold text-ink">
                      {[subject, roleLabel].filter(Boolean).join(" · ")}
                    </span>
                  ) : null}
                  <code className="break-all">
                    {row.entity_type}
                    {row.entity_id && !subject ? ` ${row.entity_id.slice(0, 8)}…` : ""}{" "}
                    {Object.keys(extra).length ? JSON.stringify(extra) : ""}
                  </code>
                </span>
              </li>
            );
          })}
          {rows.length === 0 ? <li className="px-4 py-6 text-sm text-muted">Nothing recorded yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
