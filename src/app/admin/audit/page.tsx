import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Audit log" };

const TYPES = ["events", "menu_versions", "menu_updates", "rsvps", "user_roles", "pending_role_grants", "announcements", "app_settings"];

export default async function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  await requireRole(["admin"], "/admin/audit");
  const params = await searchParams;
  const type = typeof params.type === "string" && TYPES.includes(params.type) ? params.type : null;
  const supabase = await createClient();
  let query = supabase
    .from("audit_events")
    .select("id, action, entity_type, entity_id, details, created_at, actor:profiles(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (type) query = query.eq("entity_type", type);
  const { data } = await query;
  const chip = (active: boolean) =>
    cn("inline-flex h-9 items-center rounded-full border px-3 text-xs font-semibold whitespace-nowrap", active ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-ink");

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="An append-only record of important changes, including every view of the named dietary report. Newest 200 shown."
      />
      <nav aria-label="Filter by type" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          <Link href="/admin/audit" className={chip(!type)}>All</Link>
          {TYPES.map((t) => (
            <Link key={t} href={`/admin/audit?type=${t}`} className={chip(type === t)}>
              {t.replace(/_/g, " ")}
            </Link>
          ))}
        </div>
      </nav>
      <Card className="p-0 sm:p-0">
        <ul className="divide-y divide-stone-100">
          {(data ?? []).map((row) => (
            <li key={row.id} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[170px_1fr_1.2fr] sm:gap-4">
              <span className="text-muted">{formatDateTime(row.created_at)}</span>
              <span>
                <span className="font-semibold text-ink">{row.action}</span>
                <span className="block text-xs text-muted">{row.actor?.full_name || row.actor?.email || "System"}</span>
              </span>
              <code className="break-all text-xs text-muted">
                {row.entity_type}
                {row.entity_id ? ` ${row.entity_id.slice(0, 8)}…` : ""}{" "}
                {row.details && Object.keys(row.details as object).length ? JSON.stringify(row.details) : ""}
              </code>
            </li>
          ))}
          {(data ?? []).length === 0 ? <li className="px-4 py-6 text-sm text-muted">Nothing recorded yet.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
