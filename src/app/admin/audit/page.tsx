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

// Plain-language names for each entry (falls back to the action in plain words).
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
  "announcements.insert": "Announcement created",
  "announcements.update": "Announcement changed",
  "announcements.delete": "Announcement deleted",
  "app_settings.insert": "Settings changed",
  "app_settings.update": "Settings changed",
  "volunteer.signup_removed": "Volunteer taken off a shift",
  "account.deleted": "Account deleted",
  "demo.removed": "Demo content removed",
};

// Filter chips. Most match entity_type (the audit triggers and functions in
// supabase/migrations); "dietary" picks out views of the named dietary report.
const FILTERS = [
  { value: "dietary", label: "Dietary report views" },
  { value: "user_roles", label: "Roles" },
  { value: "pending_role_grants", label: "Pending roles" },
  { value: "app_settings", label: "Settings" },
  { value: "events", label: "Events" },
  { value: "menu_versions", label: "Menus" },
  { value: "menu_updates", label: "Menu updates" },
  { value: "rsvps", label: "RSVPs" },
  { value: "volunteer_shifts", label: "Volunteers" },
  { value: "announcements", label: "Announcements" },
  { value: "profiles", label: "Account deletions" },
];

const SETTING_LABELS: Record<string, string> = {
  organization: "Contact & address",
  student_email_domains: "Student email domains",
};

// Friendly names for the columns listed in "changed" (the trigger records names, never
// values). Others read fine with underscores as spaces ("contact_name" -> "contact name").
const FIELD_LABELS: Record<string, string> = {
  slug: "web address",
  category: "type",
  visibility: "who can see it",
  starts_at: "start time",
  ends_at: "end time",
  location_name: "place",
  location_address: "address",
  rsvp_enabled: "RSVPs on or off",
  rsvp_deadline: "RSVP deadline",
  approval_mode: "approval",
  max_guests_per_rsvp: "guests allowed",
  has_meal: "meal",
  menu_voting_open: "dish voting",
  body: "message",
  audience: "who sees it",
  is_pinned: "pinned",
  is_urgent: "important",
  publish_at: "show from",
  expires_at: "hide after",
  event_id: "related event",
  prep_confirmed_at: "prep check",
};

// Bookkeeping columns that change alongside real edits; not worth showing.
const HIDDEN_FIELDS = new Set([
  "id",
  "updated_at",
  "updated_by",
  "created_at",
  "created_by",
  "granted_at",
  "granted_by",
  "published_at",
  "published_by",
  "prep_confirmed_by",
  "decided_by",
  "checked_in_by",
  "status_changed_at",
  "is_demo",
]);

// Detail keys written by the audit functions in supabase/migrations, shown below in plain words.
const KNOWN_DETAILS = new Set(["changed", "status", "role", "version", "urgent", "override", "guest_count", "attendees", "invited"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "not_going" -> "Not going" */
const humanize = (s: string) => {
  const words = s.replace(/[._]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

type Details = Record<string, unknown>;
const detailsOf = (d: unknown): Details => (d && typeof d === "object" && !Array.isArray(d) ? (d as Details) : {});
const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Short plain notes from an entry's details, e.g. "Changed: start time, place · Status: Published". */
function notesFor(details: Details): string[] {
  const notes: string[] = [];
  const status = str(details.status);
  if (Array.isArray(details.changed)) {
    const fields = details.changed
      .filter((f): f is string => typeof f === "string" && !HIDDEN_FIELDS.has(f) && !(status && f === "status"))
      .map((f) => FIELD_LABELS[f] ?? humanize(f).toLowerCase());
    if (fields.length) notes.push(`Changed: ${fields.join(", ")}`);
  }
  if (status) notes.push(`Status: ${humanize(status)}`);
  const { version, urgent, override, guest_count: guests, attendees, invited } = details;
  if (typeof version === "number") notes.push(`Version ${version}`);
  if (urgent === true) notes.push("Marked urgent");
  if (override === true) notes.push("Allowed over capacity");
  if (typeof guests === "number") notes.push(plural(guests, "guest", "guests"));
  if (typeof attendees === "number") notes.push(`${plural(attendees, "RSVP", "RSVPs")} at the time`);
  if (typeof invited === "number") notes.push(`${plural(invited, "person", "people")} invited`);
  // Anything newer than this page: show it plainly rather than hide it (ids are named in the subject).
  for (const [key, value] of Object.entries(details)) {
    if (KNOWN_DETAILS.has(key) || key.endsWith("_id")) continue;
    if (typeof value === "string" || typeof value === "number") notes.push(`${humanize(key)}: ${value}`);
  }
  return notes;
}

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
  const rows = (data ?? []).map((r) => ({ ...r, info: detailsOf(r.details) }));

  // Names for what each entry is about, one query per kind (deleted rows aren't found).
  const ids = (pick: (r: (typeof rows)[number]) => unknown) => [
    ...new Set(rows.map(pick).filter((v): v is string => typeof v === "string" && UUID.test(v))),
  ];
  const entityIds = (entityType: string) => ids((r) => (r.entity_type === entityType ? r.entity_id : null));
  const eventIds = [...new Set([...entityIds("events"), ...ids((r) => r.info.event_id)])];
  const personIds = [...new Set([...entityIds("user_roles"), ...ids((r) => r.info.user_id)])];
  const announcementIds = entityIds("announcements");
  const shiftIds = entityIds("volunteer_shifts");
  const menuIds = entityIds("menu_versions");
  const none = <T,>() => Promise.resolve({ data: [] as T[] });
  const [{ data: events }, { data: people }, { data: announcements }, { data: shifts }, { data: menus }] = await Promise.all([
    eventIds.length ? supabase.from("events").select("id, title").in("id", eventIds) : none<{ id: string; title: string }>(),
    personIds.length
      ? supabase.from("profiles").select("id, full_name, email").in("id", personIds)
      : none<{ id: string; full_name: string | null; email: string }>(),
    announcementIds.length
      ? supabase.from("announcements").select("id, title").in("id", announcementIds)
      : none<{ id: string; title: string }>(),
    shiftIds.length ? supabase.from("volunteer_shifts").select("id, title").in("id", shiftIds) : none<{ id: string; title: string }>(),
    // Menu entries don't store their event, so read its title with the menu.
    menuIds.length
      ? supabase.from("menu_versions").select("id, version, event:events(title)").in("id", menuIds)
      : none<{ id: string; version: number; event: { title: string } | null }>(),
  ]);
  const titles = new Map((events ?? []).map((e) => [e.id, e.title]));
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name || p.email]));
  const announcementTitles = new Map((announcements ?? []).map((a) => [a.id, a.title]));
  const shiftTitles = new Map((shifts ?? []).map((s) => [s.id, s.title]));
  const menuById = new Map((menus ?? []).map((m) => [m.id, m]));

  const eventName = (id: unknown) => {
    const title = typeof id === "string" ? titles.get(id) : undefined;
    return title ? `Event: ${title}` : "Deleted event";
  };
  const personName = (id: unknown) => (typeof id === "string" && names.get(id)) || "Deleted account";

  const subjectOf = (row: (typeof rows)[number]) => {
    const { entity_type: kind, entity_id: id, info } = row;
    const role = str(info.role);
    const roleLabel = role ? (ROLE_LABELS[role as Role] ?? humanize(role)) : null;
    const withRole = (who: string) => [who, roleLabel].filter(Boolean).join(" · ");
    switch (kind) {
      case "events":
        return eventName(id);
      case "rsvps":
      case "menu_updates":
        return info.event_id ? eventName(info.event_id) : undefined;
      case "menu_versions": {
        const menu = id ? menuById.get(id) : undefined;
        const title = menu?.event?.title ?? titles.get(str(info.event_id) ?? "");
        if (!title) return "Deleted menu";
        // "Menu published" entries carry the version in their details already.
        return menu && info.version === undefined ? `Menu: ${title} (version ${menu.version})` : `Menu: ${title}`;
      }
      case "user_roles":
        return withRole(personName(id));
      case "pending_role_grants":
        return withRole(id ?? "");
      case "app_settings":
        return id ? `Setting: ${SETTING_LABELS[id] ?? humanize(id)}` : undefined;
      case "announcements":
        return id && announcementTitles.has(id) ? `Announcement: ${announcementTitles.get(id)}` : "Deleted announcement";
      case "volunteer_shifts": {
        const shift = id && shiftTitles.has(id) ? `Shift: ${shiftTitles.get(id)}` : "Deleted shift";
        return info.user_id ? `${shift} · ${personName(info.user_id)}` : shift;
      }
      case "profiles":
        return undefined;
      default:
        return humanize(kind);
    }
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold",
      active ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-ink",
    );

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="A record of changes to roles, settings, events, menus and announcements, staff decisions on RSVPs, people taken off volunteer shifts, and every view of the named dietary report. Entries can't be edited or deleted. Newest 200 shown."
      />
      <nav aria-label="Filter by type" className="mb-4">
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/audit" className={chip(!type)} aria-current={!type ? "page" : undefined}>
            All
          </Link>
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/admin/audit?type=${f.value}`}
              className={chip(type === f.value)}
              aria-current={type === f.value ? "page" : undefined}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </nav>
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-stone-100">
          {rows.map((row) => {
            const subject = subjectOf(row);
            const notes = notesFor(row.info);
            return (
              <li key={row.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[170px_1fr_1.2fr] sm:gap-4">
                <span className="text-muted">{formatDateTime(row.created_at)}</span>
                <span>
                  {/* With no one behind it, removing a pending role is the first sign-in applying it. */}
                  <span className="font-semibold text-ink">
                    {row.action === "pending_role_grants.delete" && !row.actor_ref
                      ? "Pending role applied at first sign-in"
                      : (ACTION_LABELS[row.action] ?? humanize(row.action))}
                  </span>
                  <span className="block text-sm text-muted">
                    {/* actor_ref is kept after the person deletes their account. */}
                    {row.actor?.full_name || row.actor?.email || (row.actor_ref ? "Deleted account" : "System")}
                  </span>
                </span>
                <span className="min-w-0 text-sm text-muted">
                  {subject ? <span className="block font-semibold wrap-anywhere text-ink">{subject}</span> : null}
                  {notes.length ? <span className="block wrap-anywhere">{notes.join(" · ")}</span> : null}
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
