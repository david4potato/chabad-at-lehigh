import { describe, expect, it } from "vitest";
import { formatSince, hasActivity, parseMyStats, parseStaffStats, semesterStart } from "./stats";

describe("semesterStart", () => {
  it("starts the fall semester on August 1 in Bethlehem (EDT, UTC-4)", () => {
    expect(semesterStart(new Date("2026-10-17T15:00:00Z"))).toBe("2026-08-01T04:00:00.000Z");
    expect(semesterStart(new Date("2026-12-15T15:00:00Z"))).toBe("2026-08-01T04:00:00.000Z");
  });

  it("starts the spring semester on January 1 in Bethlehem (EST, UTC-5)", () => {
    expect(semesterStart(new Date("2026-03-10T15:00:00Z"))).toBe("2026-01-01T05:00:00.000Z");
    expect(semesterStart(new Date("2026-07-20T15:00:00Z"))).toBe("2026-01-01T05:00:00.000Z");
  });

  it("uses the Bethlehem date, not the UTC date, around midnight", () => {
    // 11:30 PM on July 31 in Bethlehem is already August 1 in UTC.
    expect(semesterStart(new Date("2026-08-01T03:30:00Z"))).toBe("2026-01-01T05:00:00.000Z");
    // Midnight on August 1 in Bethlehem.
    expect(semesterStart(new Date("2026-08-01T04:00:00Z"))).toBe("2026-08-01T04:00:00.000Z");
    // 10 PM on December 31 in Bethlehem is already January 1 in UTC.
    expect(semesterStart(new Date("2027-01-01T03:00:00Z"))).toBe("2026-08-01T04:00:00.000Z");
    // Midnight on January 1 in Bethlehem.
    expect(semesterStart(new Date("2027-01-01T05:00:00Z"))).toBe("2027-01-01T05:00:00.000Z");
  });
});

describe("formatSince", () => {
  it("shows the month and year in Bethlehem time", () => {
    expect(formatSince("2026-10-14T19:19:25+00:00")).toBe("October 2026");
    // 9 PM on September 30 in Bethlehem.
    expect(formatSince("2026-10-01T01:00:00Z")).toBe("September 2026");
  });
});

describe("parseMyStats", () => {
  it("reads the get_my_stats payload", () => {
    const stats = parseMyStats({
      events: 3,
      shabbat_dinners: 2,
      helped: 1,
      since: "2026-09-04T22:30:00+00:00",
      last: { title: "Shabbat dinner", slug: "shabbat-dinner-oct-9", starts_at: "2026-10-09T22:30:00+00:00" },
    });
    expect(stats).toEqual({
      events: 3,
      shabbatDinners: 2,
      helped: 1,
      since: "2026-09-04T22:30:00+00:00",
      last: { title: "Shabbat dinner", slug: "shabbat-dinner-oct-9", startsAt: "2026-10-09T22:30:00+00:00" },
    });
    expect(hasActivity(stats)).toBe(true);
  });

  it("treats a new person (or an odd payload) as no activity", () => {
    const fresh = parseMyStats({ events: 0, shabbat_dinners: 0, helped: 0, since: null, last: null });
    expect(fresh).toEqual({ events: 0, shabbatDinners: 0, helped: 0, since: null, last: null });
    expect(hasActivity(fresh)).toBe(false);

    for (const odd of [null, undefined, "x", 4, [], { events: "nope", helped: -2, last: { title: "No slug" } }]) {
      const s = parseMyStats(odd);
      expect(hasActivity(s)).toBe(false);
      expect(s.last).toBeNull();
    }
  });

  it("counts helping out as activity even without events", () => {
    expect(hasActivity(parseMyStats({ events: 0, shabbat_dinners: 0, helped: 2 }))).toBe(true);
  });

  it("accepts numbers sent as strings", () => {
    expect(parseMyStats({ events: "4" }).events).toBe(4);
  });
});

describe("parseStaffStats", () => {
  it("reads the get_staff_stats payload", () => {
    expect(
      parseStaffStats({ events_held: 9, shabbat_dinners: 7, people: 41, new_people: 12, avg_shabbat: 23, volunteer_signups: 15 }),
    ).toEqual({ eventsHeld: 9, shabbatDinners: 7, people: 41, newPeople: 12, avgShabbat: 23, volunteerSignups: 15 });
  });

  it("falls back to zeros", () => {
    expect(parseStaffStats(null)).toEqual({
      eventsHeld: 0,
      shabbatDinners: 0,
      people: 0,
      newPeople: 0,
      avgShabbat: 0,
      volunteerSignups: 0,
    });
  });
});
