import Link from "next/link";
import { formatShortDateMaybeYear } from "@/lib/time";
import { formatSince, hasActivity, type MyStats } from "@/lib/stats";
import { Card, CardTitle } from "@/components/ui/card";

/** "Your activity" on the profile: a few of your own numbers, no charts. */
export function ActivityCard({ stats }: { stats: MyStats }) {
  const tiles = [
    { label: "Events", value: stats.events },
    { label: "Shabbat dinners", value: stats.shabbatDinners },
    { label: "Times helped", value: stats.helped },
  ];

  return (
    <Card role="region" aria-labelledby="activity-heading">
      <CardTitle id="activity-heading">Your activity</CardTitle>
      {!hasActivity(stats) ? (
        <p className="mt-1 text-sm text-muted">Your first event will show up here.</p>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
            {tiles.map((t) => (
              <div key={t.label} className="flex flex-col-reverse justify-end rounded-xl bg-cream px-2 py-3 text-center sm:px-3">
                <dt className="text-xs font-medium text-muted sm:text-sm">{t.label}</dt>
                <dd className="text-2xl font-extrabold text-ink">{t.value}</dd>
              </div>
            ))}
          </dl>
          {stats.since || stats.last ? (
            <div className="mt-4 space-y-1 text-sm text-muted">
              {stats.since ? <p>Coming since {formatSince(stats.since)}</p> : null}
              {stats.last ? (
                <p>
                  Last time:{" "}
                  <Link href={`/events/${stats.last.slug}`} className="font-semibold text-brand-700 hover:underline">
                    {stats.last.title}
                  </Link>{" "}
                  · {formatShortDateMaybeYear(stats.last.startsAt)}
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
