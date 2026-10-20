import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { monthGrid } from "@/lib/calendar";
import { MonthCalendar, type CalendarEvent } from "./month-calendar";

const ev = (id: string, title: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  title,
  status: "published",
  category: "social",
  ...extra,
});

function render(selected: string | null = "2026-10-23") {
  const byDay = new Map<string, CalendarEvent[]>([
    ["2026-10-23", [ev("1", "Shabbat Dinner", { category: "shabbat_dinner" })]],
    ["2026-10-21", [ev("2", "Lunch & Learn"), ev("3", "Study Break"), ev("4", "Game Night", { status: "cancelled" })]],
  ]);
  return renderToStaticMarkup(
    <MonthCalendar
      weeks={monthGrid({ year: 2026, month: 10 })}
      eventsByDay={byDay}
      today="2026-10-17"
      selected={selected}
      dayHref={(day) => `/events?view=month&month=2026-10&day=${day}`}
      labelledBy="month-heading"
    />,
  );
}

describe("MonthCalendar", () => {
  const html = render();

  it("renders a labelled table with Sunday first", () => {
    expect(html).toContain('aria-labelledby="month-heading"');
    expect(html.indexOf("Sunday")).toBeLessThan(html.indexOf("Monday"));
    expect(html.match(/<tr>/g)).toHaveLength(6); // header + 5 weeks
  });

  it("links only days with events, with a descriptive name", () => {
    expect(html.match(/<a /g)).toHaveLength(2);
    expect(html).toContain('href="/events?view=month&amp;month=2026-10&amp;day=2026-10-23"');
    expect(html).toContain('aria-label="23 Shabbat Dinner. Friday, October 23, selected. 1 event: Shabbat Dinner"');
    expect(html).toContain("3 events: Lunch &amp; Learn; Study Break; Game Night (cancelled)");
  });

  it("shows two titles and +N more, and strikes through cancelled events", () => {
    expect(html).toContain("+1 more");
    expect(html).toContain(">Lunch &amp; Learn<");
    expect(html).not.toContain(">Game Night<"); // third event is behind "+1 more"
  });

  it("marks today", () => {
    expect(html).toContain('aria-current="date"');
    expect(html).toContain(", today");
  });

  it("marks cancelled events with a hollow dot", () => {
    const cancelled = renderToStaticMarkup(
      <MonthCalendar
        weeks={monthGrid({ year: 2026, month: 10 })}
        eventsByDay={new Map([["2026-10-05", [ev("9", "Picnic", { status: "cancelled" })]]])}
        today="2026-10-17"
        selected={null}
        dayHref={() => "#"}
        labelledBy="m"
      />,
    );
    expect(cancelled).toContain("line-through");
    expect(cancelled).toContain("border border-stone-500");
    expect(cancelled).toContain("Picnic (cancelled)");
  });
});
