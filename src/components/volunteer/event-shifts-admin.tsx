import Link from "next/link";
import { HandHeart, Plus } from "lucide-react";
import type { AdminShift } from "@/lib/data/volunteer";
import { hiddenByEventLabel, SHIFT_STATUS_LABEL } from "@/lib/data/volunteer";
import { Badge } from "@/components/ui/badge";
import { formatShortDate, formatTime } from "@/lib/time";

/** Small box on the admin event page: this event's volunteer shifts and "Add a volunteer shift". */
export function EventShiftsAdmin({ eventId, shifts }: { eventId: string; shifts: AdminShift[] }) {
  return (
    <section aria-labelledby="event-shifts-heading" className="mb-4 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
      <h2 id="event-shifts-heading" className="flex items-center gap-2 text-sm font-bold text-ink">
        <HandHeart className="size-4 text-gold-700" aria-hidden="true" /> Volunteer shifts
      </h2>
      {shifts.length > 0 ? (
        <ul className="mt-1 divide-y divide-stone-100">
          {shifts.map((s) => {
            // Shifts stay hidden from people while this event is a draft or cancelled.
            const hidden = hiddenByEventLabel(s);
            return (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-x-3 text-sm">
                <Link href={`/admin/volunteers/${s.id}`} className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
                  {s.title}
                </Link>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
                  <span>
                    {formatShortDate(s.starts_at)}, {formatTime(s.starts_at)} · {s.taken}/{s.slots} signed up
                    {s.status !== "open" ? ` · ${SHIFT_STATUS_LABEL[s.status]}` : ""}
                  </span>
                  {hidden ? <Badge>{hidden}</Badge> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">Need help cooking, setting up or cleaning up? People can sign up on the event page.</p>
      )}
      <Link
        href={`/admin/volunteers/new?event=${eventId}`}
        className="mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
      >
        <Plus className="size-4" aria-hidden="true" /> Add a volunteer shift
      </Link>
    </section>
  );
}
