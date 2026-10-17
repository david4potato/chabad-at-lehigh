import type { Metadata } from "next";
import Link from "next/link";
import { requireViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { DeleteNotificationButton, MarkAllReadButton, MarkReadOnView } from "@/components/account/notification-actions";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const viewer = await requireViewer("/notifications");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, is_urgent, read_at, created_at")
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const items = data ?? [];
  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Notifications"
        description="RSVP confirmations, waitlist updates and important menu changes."
        actions={hasUnread ? <MarkAllReadButton /> : undefined}
      />
      <MarkReadOnView hasUnread={hasUnread} />
      {items.length === 0 ? (
        <EmptyState title="You're all caught up">We&apos;ll let you know about RSVP updates and menu changes here.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {items.map((n) => (
            <li
              key={n.id}
              className={cn(
                "flex gap-3 rounded-[var(--radius-card)] border bg-white p-4 shadow-sm",
                n.is_urgent ? "border-amber-300 bg-amber-50" : n.read_at ? "border-stone-200" : "border-brand-200 bg-brand-50/40",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {n.is_urgent ? <Badge tone="amber">Urgent</Badge> : null}
                  {!n.read_at ? <Badge tone="brand">New</Badge> : null}
                  <span className="text-xs text-muted">{formatDateTime(n.created_at)}</span>
                </div>
                <p className="mt-1 font-semibold text-ink">{n.title}</p>
                {n.body ? <p className="mt-0.5 text-sm text-muted">{n.body}</p> : null}
                {n.link ? (
                  <Link href={n.link} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
                    View details →
                  </Link>
                ) : null}
              </div>
              <DeleteNotificationButton id={n.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
