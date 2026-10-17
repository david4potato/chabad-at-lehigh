import Link from "next/link";
import { formatLongDate, formatTimeRange } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import type { AdminEvent } from "@/lib/data/admin";

const STATUS_TONE = { draft: "neutral", published: "green", cancelled: "red" } as const;

export function AdminEventHeader({ event }: { event: AdminEvent }) {
  return (
    <div className="mb-4">
      <Link href="/admin/events" className="text-sm font-semibold text-brand-700 hover:underline">
        ← All events
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{event.title}</h1>
        <Badge tone={STATUS_TONE[event.status]}>{event.status[0].toUpperCase() + event.status.slice(1)}</Badge>
      </div>
      <p className="mt-1 text-muted">
        {formatLongDate(event.starts_at)} · {formatTimeRange(event.starts_at, event.ends_at)}
        {event.status !== "draft" ? (
          <>
            {" · "}
            <Link href={`/events/${event.slug}`} className="font-semibold text-brand-700 hover:underline">
              View public page
            </Link>
          </>
        ) : null}
      </p>
    </div>
  );
}
