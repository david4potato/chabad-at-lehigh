import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDayKey } from "@/lib/time";
import type { CalendarCell, DayKey } from "@/lib/calendar";
import type { EventCategory, EventStatus } from "@/lib/data/events";
import { plural } from "./event-utils";

export type CalendarEvent = { id: string; title: string; status: EventStatus; category: EventCategory };

const WEEKDAYS = [
  ["Sun", "Sunday"],
  ["Mon", "Monday"],
  ["Tue", "Tuesday"],
  ["Wed", "Wednesday"],
  ["Thu", "Thursday"],
  ["Fri", "Friday"],
  ["Sat", "Saturday"],
] as const;

const MAX_TITLES = 2; // titles shown per day on wider screens
const MAX_DOTS = 3; // dots shown per day on phones

/**
 * "23 Lunch & Learn Shabbat Dinner. Friday, October 23, today. 2 events: Lunch & Learn; Shabbat Dinner (cancelled)".
 * It starts with what's visible in the cell (the day, and on wider screens the titles), so voice control works.
 */
function dayLabel(key: DayKey, events: readonly CalendarEvent[], isToday: boolean, isSelected: boolean) {
  const more = events.length - MAX_TITLES;
  const visible = [String(Number(key.slice(8))), ...events.slice(0, MAX_TITLES).map((e) => e.title), more > 0 ? `+${more} more` : ""];
  let label = `${visible.filter(Boolean).join(" ")}. ${formatDayKey(key)}`;
  if (isToday) label += ", today";
  if (isSelected) label += ", selected";
  if (events.length > 0) {
    const titles = events.map((e) => (e.status === "cancelled" ? `${e.title} (cancelled)` : e.title));
    label += `. ${plural(events.length, "event")}: ${titles.join("; ")}`;
  }
  return label;
}

/**
 * Month grid (Sunday first). Days with events link to `dayHref(day)`; phones
 * show dots, wider screens show up to two titles and "+N more". Cancelled
 * events are struck through (titles) or hollow (dots), never color alone.
 */
export function MonthCalendar({
  weeks,
  eventsByDay,
  today,
  selected,
  dayHref,
  labelledBy,
}: {
  weeks: CalendarCell[][];
  eventsByDay: ReadonlyMap<DayKey, readonly CalendarEvent[]>;
  today: DayKey;
  selected: DayKey | null;
  dayHref: (day: DayKey) => string;
  labelledBy: string;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-stone-200 bg-white p-1 shadow-sm sm:p-2">
      <table aria-labelledby={labelledBy} className="w-full table-fixed border-separate border-spacing-px sm:border-spacing-1">
        <thead>
          <tr>
            {WEEKDAYS.map(([short, long]) => (
              <th key={short} scope="col" className="py-2 text-center text-sm font-bold uppercase tracking-wide text-muted">
                <span aria-hidden="true">{short}</span>
                <span className="sr-only">{long}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].key}>
              {week.map((cell) => (
                <td key={cell.key} className="p-0 align-top">
                  {cell.inMonth ? (
                    <DayCell
                      cell={cell}
                      events={eventsByDay.get(cell.key) ?? []}
                      isToday={cell.key === today}
                      isSelected={cell.key === selected}
                      href={dayHref(cell.key)}
                    />
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DayCell({
  cell,
  events,
  isToday,
  isSelected,
  href,
}: {
  cell: CalendarCell;
  events: readonly CalendarEvent[];
  isToday: boolean;
  isSelected: boolean;
  href: string;
}) {
  const base = cn(
    "flex h-12 w-full min-w-0 flex-col items-center overflow-hidden rounded-lg pt-1 md:h-24 md:items-stretch md:px-1",
    isSelected ? "bg-brand-50 ring-2 ring-inset ring-brand-700" : events.length > 0 ? "bg-white ring-1 ring-inset ring-stone-300" : "bg-stone-50",
  );
  const number = (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full text-sm tabular-nums md:self-start",
        isToday ? "bg-gold-400 font-extrabold text-ink" : events.length > 0 ? "font-bold text-ink" : "font-medium text-muted",
      )}
    >
      {cell.day}
    </span>
  );

  if (events.length === 0) {
    return (
      <div className={base} aria-current={isToday ? "date" : undefined}>
        {number}
        {isToday ? <span className="sr-only">, today</span> : null}
      </div>
    );
  }

  return (
    <Link
      href={href}
      prefetch={false}
      aria-label={dayLabel(cell.key, events, isToday, isSelected)}
      aria-current={isToday ? "date" : undefined}
      className={cn(base, "transition-colors hover:bg-brand-50")}
    >
      {number}
      {/* Phones: one dot per event (hollow when cancelled). */}
      <span className="mt-auto mb-2 flex items-center justify-center gap-1 md:hidden" aria-hidden="true">
        {events.slice(0, MAX_DOTS).map((e) => (
          <span
            key={e.id}
            className={cn(
              "size-1.5 rounded-full",
              e.status === "cancelled" ? "border border-stone-500" : "bg-brand-700",
            )}
          />
        ))}
      </span>
      {/* Wider screens: up to two titles, then "+N more". */}
      <span className="mt-1 hidden min-w-0 space-y-1 md:block" aria-hidden="true">
        {events.slice(0, MAX_TITLES).map((e) => (
          <span
            key={e.id}
            className={cn(
              "block truncate rounded px-1 text-sm leading-5 font-semibold",
              e.status === "cancelled"
                ? "bg-stone-100 text-muted line-through"
                : e.category === "shabbat_dinner"
                  ? "bg-gold-100 text-gold-800"
                  : "bg-brand-50 text-brand-800",
            )}
          >
            {e.title}
          </span>
        ))}
        {events.length > MAX_TITLES ? (
          <span className="block px-1 text-sm leading-4 font-semibold text-muted">+{events.length - MAX_TITLES} more</span>
        ) : null}
      </span>
    </Link>
  );
}
