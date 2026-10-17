import Link from "next/link";
import { Megaphone, Pin } from "lucide-react";
import { formatShortDate } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import type { AnnouncementItem } from "@/lib/data/events";
import { paragraphs } from "./event-utils";

export function AnnouncementList({ items, compact = false }: { items: AnnouncementItem[]; compact?: boolean }) {
  return (
    <ul className="space-y-3">
      {items.map((a) => (
        <li
          key={a.id}
          className={cn(
            "rounded-[var(--radius-card)] border bg-white p-4 shadow-sm sm:p-5",
            a.is_urgent ? "border-amber-300 bg-amber-50" : "border-stone-200",
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            {a.is_urgent ? <Badge tone="amber">Important</Badge> : null}
            {a.is_pinned ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-gold-700">
                <Pin className="size-3.5" aria-hidden="true" /> Pinned
              </span>
            ) : null}
            <span className="text-xs text-muted">{formatShortDate(a.publish_at)}</span>
          </div>
          <h3 className="mt-1.5 flex items-start gap-2 text-base font-bold text-ink">
            {!compact ? <Megaphone className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden="true" /> : null}
            {a.title}
          </h3>
          {a.body ? (
            <div className={cn("prose-simple mt-1 text-sm leading-relaxed text-muted", compact && "line-clamp-3")}>
              {paragraphs(a.body).map((p, i) => (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ))}
            </div>
          ) : null}
          {a.event ? (
            <Link href={`/events/${a.event.slug}`} className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
              {a.event.title} →
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
