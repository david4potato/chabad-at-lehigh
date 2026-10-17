import Link from "next/link";
import type { ShiftView } from "@/lib/data/volunteer";
import { Card, CardTitle } from "@/components/ui/card";
import { ShiftList } from "./shift-card";

/** Compact "Help out" section for an event page. Renders nothing when the event has no open shifts. */
export function EventHelpOut({ shifts, slug, signedIn }: { shifts: ShiftView[]; slug: string; signedIn: boolean }) {
  if (shifts.length === 0) return null;
  return (
    <Card id="help-out" className="scroll-mt-24">
      <CardTitle>Help out</CardTitle>
      <p className="mt-1 text-sm text-muted">Lend a hand with this event. It&apos;s a nice way to meet people.</p>
      <div className="mt-4">
        <ShiftList shifts={shifts} signedIn={signedIn} nextPath={`/events/${slug}#help-out`} showDate showEvent={false} />
      </div>
      <p className="mt-3 text-sm">
        <Link href="/volunteer" className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
          See all ways to help
        </Link>
      </p>
    </Card>
  );
}
