import Link from "next/link";
import { CalendarDays, Clock } from "lucide-react";
import type { ShiftView } from "@/lib/data/volunteer";
import { formatEventWhen, formatTimeRange } from "@/lib/time";
import { cn } from "@/lib/cn";
import { SignupControls } from "./signup-controls";

/** "3 of 4 spots left", or "4 of 4 spots taken" when full. */
export function spotsLeftText(taken: number, slots: number) {
  const left = Math.max(0, slots - taken);
  const noun = slots === 1 ? "spot" : "spots";
  return left === 0 ? `${slots} of ${slots} ${noun} taken` : `${left} of ${slots} ${noun} left`;
}

type Props = {
  shift: ShiftView;
  signedIn: boolean;
  /** Where signed-out visitors return after signing in. */
  nextPath: string;
  /** Show the day as well as the time (when the list isn't grouped by day). */
  showDate?: boolean;
  /** Link to the shift's event (off on that event's own page). */
  showEvent?: boolean;
};

/** One volunteer shift with its time, spots left and a one-tap sign-up. */
export function ShiftCard({ shift, signedIn, nextPath, showDate = false, showEvent = true }: Props) {
  const titleId = `shift-${shift.id}-title`;
  const full = shift.taken >= shift.slots;
  const left = Math.max(0, shift.slots - shift.taken);

  return (
    <li className="rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1.5">
          <h3 id={titleId} className="text-base font-bold text-ink">
            {shift.title}
          </h3>
          <p className="flex items-start gap-2 text-sm text-ink">
            <Clock className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>{showDate ? formatEventWhen(shift.starts_at, shift.ends_at) : formatTimeRange(shift.starts_at, shift.ends_at)}</span>
          </p>
          {showEvent && shift.event ? (
            <p className="flex items-start gap-2 text-sm text-ink">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span>
                For{" "}
                <Link href={`/events/${shift.event.slug}`} className="font-semibold text-brand-700 hover:underline">
                  {shift.event.title}
                </Link>
              </span>
            </p>
          ) : null}
          {shift.description ? <p className="whitespace-pre-line text-sm text-muted">{shift.description}</p> : null}
          <p className={cn("text-sm font-semibold", full ? "text-amber-800" : left <= 1 ? "text-gold-700" : "text-muted")}>
            {spotsLeftText(shift.taken, shift.slots)}
          </p>
        </div>
        <div className="shrink-0 sm:max-w-64">
          <SignupControls
            shiftId={shift.id}
            titleId={titleId}
            mine={shift.mine}
            full={full}
            started={shift.started}
            closed={shift.closed}
            signedIn={signedIn}
            nextPath={nextPath}
          />
        </div>
      </div>
    </li>
  );
}

/** A list of shift cards. */
export function ShiftList({ shifts, ...rest }: Omit<Props, "shift"> & { shifts: ShiftView[] }) {
  return (
    <ul className="space-y-3">
      {shifts.map((s) => (
        <ShiftCard key={s.id} shift={s} {...rest} />
      ))}
    </ul>
  );
}
