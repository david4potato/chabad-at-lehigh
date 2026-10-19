import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import { getViewer } from "@/lib/auth";
import { listOpenShifts, type ShiftView } from "@/lib/data/volunteer";
import { formatLongDate, relativeDay, toDateTimeLocalValue } from "@/lib/time";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button";
import { ShiftList } from "@/components/volunteer/shift-card";

export const metadata: Metadata = {
  title: "Help out",
  description: `Sign up to help cook, set up or clean up at ${SITE.name}.`,
};

const INTRO = "Cooking, setting up and cleaning up together is a big part of Shabbat here.";

/** Group shifts by their day in site time, keeping the soonest-first order. */
function groupByDay(shifts: ShiftView[]) {
  const groups = new Map<string, ShiftView[]>();
  for (const s of shifts) {
    const day = toDateTimeLocalValue(s.starts_at).slice(0, 10);
    groups.set(day, [...(groups.get(day) ?? []), s]);
  }
  return [...groups.entries()].map(([day, items]) => ({ day, items }));
}

export default async function VolunteerPage() {
  const viewer = await getViewer();
  const shifts = await listOpenShifts({ viewerId: viewer?.id });
  const groups = groupByDay(shifts);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Help out" description={INTRO} />

      {!viewer && shifts.length > 0 ? (
        <p className="-mt-2 mb-6 text-sm text-muted">
          <Link href="/sign-in?next=%2Fvolunteer" prefetch={false} className="font-semibold text-brand-700 hover:underline">
            Sign in
          </Link>{" "}
          to save your spot. It takes a minute.
        </p>
      ) : null}

      {groups.length === 0 ? (
        <EmptyState title="Nothing to sign up for right now" action={<ButtonLink href="/events" variant="secondary">See events</ButtonLink>}>
          New ways to help are posted before Shabbat dinners and holidays. Check back soon.
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {groups.map(({ day, items }) => {
            const rel = relativeDay(items[0].starts_at);
            return (
              <section key={day} aria-labelledby={`day-${day}`}>
                <h2 id={`day-${day}`} className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
                  {rel === "Today" || rel === "Tomorrow" ? `${rel} · ` : null}
                  {formatLongDate(items[0].starts_at)}
                </h2>
                <ShiftList shifts={items} signedIn={Boolean(viewer)} nextPath="/volunteer" />
              </section>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-sm text-muted">
        Want to help in another way? Tell an organizer. We&apos;d love to have you.
      </p>
    </div>
  );
}
