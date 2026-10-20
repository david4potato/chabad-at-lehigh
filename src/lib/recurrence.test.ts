import { describe, expect, it } from "vitest";
import { localDaysBetween, repeatStarts, shiftLocalDays } from "./recurrence";

// Fri 23 Oct 2026, 7:00 PM in Bethlehem (EDT, UTC-4).
const FRIDAY_7PM = "2026-10-23T23:00:00.000Z";
const BEFORE = new Date("2026-10-20T12:00:00Z");

describe("repeatStarts", () => {
  it("repeats weekly at the same clock time, across the fall-back change", () => {
    expect(repeatStarts(FRIDAY_7PM, 1, 3, BEFORE)).toEqual([
      "2026-10-30T23:00:00.000Z", // 7 PM EDT
      "2026-11-07T00:00:00.000Z", // 7 PM EST (clocks went back on Nov 1)
      "2026-11-14T00:00:00.000Z",
    ]);
  });

  it("repeats every two weeks", () => {
    expect(repeatStarts(FRIDAY_7PM, 2, 2, BEFORE)).toEqual(["2026-11-07T00:00:00.000Z", "2026-11-21T00:00:00.000Z"]);
  });

  it("keeps the clock time across the spring-forward change", () => {
    // Thu 4 Mar 2027, 4:00 PM EST; clocks go forward on Sun 14 Mar.
    expect(repeatStarts("2027-03-04T21:00:00.000Z", 1, 2, new Date("2027-03-01T00:00:00Z"))).toEqual([
      "2027-03-11T21:00:00.000Z", // 4 PM EST
      "2027-03-18T20:00:00.000Z", // 4 PM EDT
    ]);
  });

  it("starts an old event from the first date still ahead, in the same rhythm", () => {
    // Every two weeks from 23 Oct: 6 Nov and 20 Nov have passed by 25 Nov, so 4 Dec comes first.
    expect(repeatStarts(FRIDAY_7PM, 2, 2, new Date("2026-11-25T12:00:00Z"))).toEqual([
      "2026-12-05T00:00:00.000Z",
      "2026-12-19T00:00:00.000Z",
    ]);
  });

  it("returns exactly the number asked for", () => {
    expect(repeatStarts(FRIDAY_7PM, 1, 26, BEFORE)).toHaveLength(26);
    expect(repeatStarts(FRIDAY_7PM, 1, 0, BEFORE)).toEqual([]);
  });
});

describe("shiftLocalDays", () => {
  it("keeps the clock time when a week crosses the fall-back change", () => {
    // Fri 30 Oct 2026, 5:00 PM EDT, to Fri 6 Nov, 5:00 PM EST.
    expect(shiftLocalDays("2026-10-30T21:00:00.000Z", 7)).toBe("2026-11-06T22:00:00.000Z");
  });

  it("counts calendar days on campus, not 24-hour blocks", () => {
    expect(localDaysBetween("2026-10-30T21:00:00.000Z", "2026-11-06T22:00:00.000Z")).toBe(7);
    // 11 PM Bethlehem time is already the next day in UTC; it's still the same campus day.
    expect(localDaysBetween("2026-10-23T03:00:00.000Z", "2026-10-22T16:00:00.000Z")).toBe(0);
  });
});
