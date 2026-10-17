import { describe, expect, it } from "vitest";
import {
  addMonths,
  buildCalendarFeed,
  clampMonth,
  currentMonth,
  daysInMonth,
  eventDays,
  googleCalendarSubscribeUrl,
  groupByDay,
  MAX_EVENT_SPAN_DAYS,
  monthGrid,
  monthKey,
  monthRange,
  monthsBetween,
  nextEventDay,
  parseDay,
  parseMonth,
  pickSelectedDay,
  webcalUrl,
  type CalendarCell,
} from "./calendar";

const inMonthKeys = (weeks: CalendarCell[][]) => weeks.flat().filter((c) => c.inMonth).map((c) => c.key);

/** Every cell is exactly one day after the previous one. */
function expectConsecutive(weeks: CalendarCell[][]) {
  const keys = weeks.flat().map((c) => c.key);
  for (let i = 1; i < keys.length; i++) {
    const prev = Date.parse(`${keys[i - 1]}T00:00:00Z`);
    const next = Date.parse(`${keys[i]}T00:00:00Z`);
    expect(next - prev, `${keys[i - 1]} -> ${keys[i]}`).toBe(86_400_000);
  }
}

describe("parseMonth", () => {
  it("reads YYYY-MM", () => {
    expect(parseMonth("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(parseMonth("2027-01")).toEqual({ year: 2027, month: 1 });
  });

  it.each([undefined, null, "", "2026-13", "2026-00", "2026-1", "26-10", "2026-10-01", ["2026-10"], "1999-12", "abcd-ef"])(
    "returns null for %j",
    (value) => {
      expect(parseMonth(value)).toBeNull();
    },
  );
});

describe("currentMonth", () => {
  it("uses Bethlehem's calendar, not UTC", () => {
    // 11:30 PM on Oct 31 in Bethlehem is already Nov 1 in UTC.
    expect(currentMonth(new Date("2026-11-01T03:30:00Z"))).toEqual({ year: 2026, month: 10 });
    expect(currentMonth(new Date("2026-11-01T05:00:00Z"))).toEqual({ year: 2026, month: 11 });
  });
});

describe("addMonths / monthsBetween / clampMonth", () => {
  it("rolls over years in both directions", () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 10 }, -22)).toEqual({ year: 2024, month: 12 });
    expect(addMonths({ year: 2026, month: 10 }, 15)).toEqual({ year: 2028, month: 1 });
  });

  it("counts months between two months", () => {
    expect(monthsBetween({ year: 2026, month: 10 }, { year: 2027, month: 2 })).toBe(4);
    expect(monthsBetween({ year: 2026, month: 10 }, { year: 2026, month: 3 })).toBe(-7);
  });

  it("keeps a month inside the allowed range", () => {
    const anchor = { year: 2026, month: 10 };
    expect(clampMonth({ year: 2026, month: 12 }, anchor, 24, 12)).toEqual({ year: 2026, month: 12 });
    expect(clampMonth({ year: 2030, month: 1 }, anchor, 24, 12)).toEqual({ year: 2027, month: 10 });
    expect(clampMonth({ year: 2020, month: 1 }, anchor, 24, 12)).toEqual({ year: 2024, month: 10 });
  });

  it("formats month keys", () => {
    expect(monthKey({ year: 2026, month: 3 })).toBe("2026-03");
  });
});

describe("parseDay", () => {
  const oct = { year: 2026, month: 10 };

  it("accepts real days in the month", () => {
    expect(parseDay("2026-10-01", oct)).toBe("2026-10-01");
    expect(parseDay("2026-10-31", oct)).toBe("2026-10-31");
  });

  it.each(["2026-10-32", "2026-10-00", "2026-11-01", "2026-10-1", "", undefined, ["2026-10-01"]])(
    "rejects %j",
    (value) => {
      expect(parseDay(value, oct)).toBeNull();
    },
  );

  it("knows month lengths, including leap years", () => {
    expect(parseDay("2026-02-29", { year: 2026, month: 2 })).toBeNull();
    expect(parseDay("2028-02-29", { year: 2028, month: 2 })).toBe("2028-02-29");
    expect(daysInMonth({ year: 2026, month: 4 })).toBe(30);
  });
});

describe("monthGrid", () => {
  it("starts weeks on Sunday and pads with the neighbouring months", () => {
    // October 2026 starts on a Thursday.
    const weeks = monthGrid({ year: 2026, month: 10 });
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0].map((c) => c.key)).toEqual([
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]);
    expect(weeks[0].map((c) => c.inMonth)).toEqual([false, false, false, false, true, true, true]);
    // Friday, October 23 sits in the Friday column.
    const fri23 = weeks.flatMap((w) => w.map((c, i) => ({ c, i }))).find(({ c }) => c.key === "2026-10-23");
    expect(fri23?.i).toBe(5);
    expect(weeks[4].at(-1)).toEqual({ key: "2026-10-31", day: 31, inMonth: true });
    expect(inMonthKeys(weeks)).toHaveLength(31);
    expectConsecutive(weeks);
  });

  it("handles a month that starts on Saturday (six weeks)", () => {
    // August 2026 starts on a Saturday and has 31 days.
    const weeks = monthGrid({ year: 2026, month: 8 });
    expect(weeks).toHaveLength(6);
    expect(weeks[0].slice(0, 6).every((c) => !c.inMonth)).toBe(true);
    expect(weeks[0][6]).toEqual({ key: "2026-08-01", day: 1, inMonth: true });
    expect(weeks[5][1]).toEqual({ key: "2026-08-31", day: 31, inMonth: true });
    expect(weeks[5][2].inMonth).toBe(false);
    expect(inMonthKeys(weeks)).toHaveLength(31);
    expectConsecutive(weeks);
  });

  it("handles a February that fits in exactly four weeks", () => {
    // February 2026 starts on a Sunday and has 28 days.
    const weeks = monthGrid({ year: 2026, month: 2 });
    expect(weeks).toHaveLength(4);
    expect(weeks.flat().every((c) => c.inMonth)).toBe(true);
  });

  it("is not thrown off by the spring-forward change (March 2026)", () => {
    const weeks = monthGrid({ year: 2026, month: 3 });
    // March 1, 2026 is a Sunday; clocks change on Sunday, March 8.
    expect(weeks[0][0]).toEqual({ key: "2026-03-01", day: 1, inMonth: true });
    expect(weeks[1][0].key).toBe("2026-03-08");
    expect(weeks[1][1].key).toBe("2026-03-09");
    expect(inMonthKeys(weeks)).toHaveLength(31);
    expect(new Set(inMonthKeys(weeks)).size).toBe(31);
    expectConsecutive(weeks);
  });

  it("is not thrown off by the fall-back change (November 2026)", () => {
    const weeks = monthGrid({ year: 2026, month: 11 });
    // November 1, 2026 is a Sunday and the day clocks go back.
    expect(weeks).toHaveLength(5);
    expect(weeks[0][0]).toEqual({ key: "2026-11-01", day: 1, inMonth: true });
    expect(weeks[0][1].key).toBe("2026-11-02");
    expect(weeks[4][1]).toEqual({ key: "2026-11-30", day: 30, inMonth: true });
    expect(inMonthKeys(weeks)).toHaveLength(30);
    expect(new Set(inMonthKeys(weeks)).size).toBe(30);
    expectConsecutive(weeks);
  });

  it("crosses a year boundary", () => {
    const weeks = monthGrid({ year: 2027, month: 1 });
    // January 1, 2027 is a Friday.
    expect(weeks[0][4].key).toBe("2026-12-31");
    expect(weeks[0][5]).toEqual({ key: "2027-01-01", day: 1, inMonth: true });
  });
});

describe("monthRange", () => {
  it("uses midnight in Bethlehem, including the daylight saving offset", () => {
    expect(monthRange({ year: 2026, month: 10 })).toEqual({
      from: "2026-10-01T04:00:00.000Z",
      to: "2026-11-01T04:00:00.000Z",
    });
    expect(monthRange({ year: 2026, month: 3 })).toEqual({
      from: "2026-03-01T05:00:00.000Z",
      to: "2026-04-01T04:00:00.000Z",
    });
    expect(monthRange({ year: 2026, month: 11 })).toEqual({
      from: "2026-11-01T04:00:00.000Z",
      to: "2026-12-01T05:00:00.000Z",
    });
    expect(monthRange({ year: 2026, month: 12 }).to).toBe("2027-01-01T05:00:00.000Z");
  });
});

describe("groupByDay", () => {
  it("groups by the Bethlehem calendar day and keeps order", () => {
    const events = [
      { id: "a", starts_at: "2026-10-23T22:30:00Z" }, // Fri 6:30 PM
      { id: "b", starts_at: "2026-10-24T03:30:00Z" }, // Fri 11:30 PM (Sat in UTC)
      { id: "c", starts_at: "2026-10-24T14:00:00Z" }, // Sat 10 AM
    ];
    const map = groupByDay(events);
    expect([...map.keys()]).toEqual(["2026-10-23", "2026-10-24"]);
    expect(map.get("2026-10-23")?.map((e) => e.id)).toEqual(["a", "b"]);
    expect(map.get("2026-10-24")?.map((e) => e.id)).toEqual(["c"]);
  });

  it("lists an event on every day it spans, before that day's own events", () => {
    const events = [
      { id: "shabbaton", starts_at: "2026-10-23T22:00:00Z", ends_at: "2026-10-25T01:00:00Z" }, // Fri 6 PM – Sat 9 PM
      { id: "kiddush", starts_at: "2026-10-24T16:00:00Z", ends_at: "2026-10-24T17:00:00Z" }, // Sat noon
    ];
    const map = groupByDay(events);
    expect([...map.keys()]).toEqual(["2026-10-23", "2026-10-24"]);
    expect(map.get("2026-10-23")?.map((e) => e.id)).toEqual(["shabbaton"]);
    expect(map.get("2026-10-24")?.map((e) => e.id)).toEqual(["shabbaton", "kiddush"]);
  });

  it("keeps only the given month's days", () => {
    const events = [{ id: "retreat", starts_at: "2026-09-30T14:00:00Z", ends_at: "2026-10-02T20:00:00Z" }];
    expect([...groupByDay(events).keys()]).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
    expect([...groupByDay(events, { year: 2026, month: 10 }).keys()]).toEqual(["2026-10-01", "2026-10-02"]);
    expect([...groupByDay(events, { year: 2026, month: 9 }).keys()]).toEqual(["2026-09-30"]);
  });
});

describe("eventDays", () => {
  it("is the start day for events without an end or within one day", () => {
    expect(eventDays("2026-10-23T22:30:00Z")).toEqual(["2026-10-23"]);
    expect(eventDays("2026-10-23T22:30:00Z", null)).toEqual(["2026-10-23"]);
    expect(eventDays("2026-10-23T22:30:00Z", "2026-10-24T01:00:00Z")).toEqual(["2026-10-23"]); // 6:30–9 PM
  });

  it("uses Bethlehem days for overnight events", () => {
    // Friday 9 PM to Saturday 1 AM.
    expect(eventDays("2026-10-24T01:00:00Z", "2026-10-24T05:00:00Z")).toEqual(["2026-10-23", "2026-10-24"]);
  });

  it("does not spill into the next day when an event ends exactly at midnight", () => {
    expect(eventDays("2026-10-23T23:00:00Z", "2026-10-24T04:00:00Z")).toEqual(["2026-10-23"]); // 7 PM – midnight
  });

  it("ignores an end before the start", () => {
    expect(eventDays("2026-10-23T22:30:00Z", "2026-10-20T22:30:00Z")).toEqual(["2026-10-23"]);
  });

  it("steps across month ends and the fall-back change", () => {
    expect(eventDays("2026-10-31T14:00:00Z", "2026-11-02T20:00:00Z")).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(eventDays("2026-12-31T14:00:00Z", "2027-01-01T20:00:00Z")).toEqual(["2026-12-31", "2027-01-01"]);
  });

  it(`stops after ${MAX_EVENT_SPAN_DAYS} days`, () => {
    const days = eventDays("2026-10-01T14:00:00Z", "2027-10-01T14:00:00Z");
    expect(days).toHaveLength(MAX_EVENT_SPAN_DAYS);
    expect(days[0]).toBe("2026-10-01");
    expect(days.at(-1)).toBe("2026-10-14");
  });
});

describe("pickSelectedDay / nextEventDay", () => {
  const oct = { year: 2026, month: 10 };
  const days = ["2026-10-30", "2026-10-23"];

  it("prefers the requested day", () => {
    expect(pickSelectedDay(oct, "2026-10-05", "2026-10-17", days)).toBe("2026-10-05");
  });

  it("falls back to today when it is in the month", () => {
    expect(pickSelectedDay(oct, null, "2026-10-17", days)).toBe("2026-10-17");
  });

  it("otherwise picks the first day with events, or none", () => {
    expect(pickSelectedDay(oct, null, "2026-09-30", days)).toBe("2026-10-23");
    expect(pickSelectedDay(oct, null, "2026-09-30", [])).toBeNull();
  });

  it("finds the next day with events", () => {
    expect(nextEventDay("2026-10-17", days)).toBe("2026-10-23");
    expect(nextEventDay("2026-10-23", days)).toBe("2026-10-30");
    expect(nextEventDay("2026-10-30", days)).toBeNull();
  });
});

describe("buildCalendarFeed", () => {
  const now = new Date("2026-10-17T12:00:00Z");
  const feed = buildCalendarFeed(
    [
      {
        id: "11111111-1111-1111-1111-111111111111",
        slug: "shabbat-dinner",
        title: "Shabbat Dinner",
        summary: "Dinner, songs; and friends",
        starts_at: "2026-10-23T22:30:00Z",
        ends_at: "2026-10-24T01:00:00Z",
        location_name: "Chabad House",
        location_address: "123 Main St, Bethlehem, PA",
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        slug: "lunch-and-learn",
        title: "Lunch & Learn",
        summary: null,
        starts_at: "2026-10-21T16:00:00Z",
        ends_at: null,
        location_name: null,
        location_address: null,
      },
    ],
    { siteUrl: "https://example.org", name: "Chabad at Lehigh", now },
  );
  const lines = feed.split("\r\n");

  it("wraps events in one VCALENDAR with a calendar name", () => {
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("X-WR-CALNAME:Chabad at Lehigh");
    expect(lines).toContain("X-WR-TIMEZONE:America/New_York");
    expect(feed.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(lines.filter((l) => l === "BEGIN:VEVENT")).toHaveLength(2);
    expect(lines.filter((l) => l === "END:VEVENT")).toHaveLength(2);
  });

  it("gives each event a stable UID and UTC times", () => {
    expect(lines).toContain("UID:11111111-1111-1111-1111-111111111111@chabad-at-lehigh");
    expect(lines).toContain("UID:22222222-2222-2222-2222-222222222222@chabad-at-lehigh");
    expect(lines).toContain("DTSTART:20261023T223000Z");
    expect(lines).toContain("DTEND:20261024T010000Z");
    expect(lines).toContain("DTSTAMP:20261017T120000Z");
  });

  it("defaults to two hours when there is no end time", () => {
    expect(lines).toContain("DTSTART:20261021T160000Z");
    expect(lines).toContain("DTEND:20261021T180000Z");
  });

  it("escapes text and links back to the event page", () => {
    expect(lines).toContain("SUMMARY:Lunch & Learn");
    expect(lines).toContain("LOCATION:Chabad House\\, 123 Main St\\, Bethlehem\\, PA");
    expect(feed).toContain("URL:https://example.org/events/shabbat-dinner");
    expect(lines).toContain("DESCRIPTION:https://example.org/events/lunch-and-learn");
    expect(lines.some((l) => l.startsWith("LOCATION:") && l.includes("Lunch"))).toBe(false);
  });

  it("keeps every line within 75 octets", () => {
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("is still valid with no events", () => {
    const empty = buildCalendarFeed([], { siteUrl: "https://example.org", name: "Chabad at Lehigh", now });
    expect(empty).toContain("BEGIN:VCALENDAR");
    expect(empty).not.toContain("BEGIN:VEVENT");
  });
});

describe("subscribe links", () => {
  it("builds webcal and Google Calendar links", () => {
    const url = "https://chabad.example.org/events/calendar.ics";
    expect(webcalUrl(url)).toBe("webcal://chabad.example.org/events/calendar.ics");
    expect(webcalUrl("http://localhost:3000/events/calendar.ics")).toBe("webcal://localhost:3000/events/calendar.ics");
    expect(googleCalendarSubscribeUrl(url)).toBe(
      "https://calendar.google.com/calendar/r?cid=webcal%3A%2F%2Fchabad.example.org%2Fevents%2Fcalendar.ics",
    );
  });
});
