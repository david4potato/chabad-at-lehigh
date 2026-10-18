import Link from "next/link";
import { formatEventWhen } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { ShareButton } from "@/components/events/share-button";
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
      <p className="mt-1 text-muted">{formatEventWhen(event.starts_at, event.ends_at)}</p>
      {event.status !== "draft" ? (
        <div className="flex flex-wrap items-center gap-x-5">
          <Link href={`/events/${event.slug}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
            View public page
          </Link>
          {event.status === "published" ? <ShareButton title={event.title} path={`/events/${event.slug}`} label="Copy event link" /> : null}
        </div>
      ) : null}
    </div>
  );
}
