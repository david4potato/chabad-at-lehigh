import type { StaffStats } from "@/lib/stats";

/** "This semester" on the dashboard Overview: a handful of counts, numbers only. */
export function StatsRow({ stats, since }: { stats: StaffStats; since: string }) {
  const tiles = [
    { label: "Events held", value: stats.eventsHeld },
    { label: "Shabbat dinners", value: stats.shabbatDinners },
    { label: "People who came", value: stats.people },
    { label: "New faces", value: stats.newPeople },
    { label: "Avg. at Shabbat", value: stats.avgShabbat },
    { label: "Volunteer sign-ups", value: stats.volunteerSignups },
  ];

  return (
    <section aria-labelledby="semester-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id="semester-heading" className="text-lg font-bold text-ink">
          This semester
        </h2>
        <p className="text-sm text-muted">Since {since} · past events only</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="flex flex-col-reverse justify-end rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm"
          >
            <dt className="text-sm text-muted">{t.label}</dt>
            <dd className="text-2xl font-extrabold text-ink">{t.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
