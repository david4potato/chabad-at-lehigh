import { describe, expect, it } from "vitest";
import {
  SITE_TIME_ZONE,
  formatDateTime,
  formatEventWhen,
  formatLongDate,
  formatShortDate,
  formatTime,
  formatTimeRange,
  isPast,
  relativeDay,
  siteLocalToUtcIso,
  spansDays,
  toDateTimeLocalValue,
} from "./time";

// Newer ICU versions put a narrow no-break space before AM/PM. Normalize so the
// tests don't depend on the Node/ICU version.
const plain = (s: string) => s.replace(/\s/g, " ");

describe("siteLocalToUtcIso", () => {
  it("uses Bethlehem time, not the server's time zone", () => {
    expect(SITE_TIME_ZONE).toBe("America/New_York");
  });

  it("applies the summer (EDT, UTC-4) offset", () => {
    expect(siteLocalToUtcIso("2026-07-15T18:30")).toBe("2026-07-15T22:30:00.000Z");
  });

  it("applies the winter (EST, UTC-5) offset", () => {
    expect(siteLocalToUtcIso("2026-01-15T18:30")).toBe("2026-01-15T23:30:00.000Z");
  });

  it("handles the spring-forward day (2026-03-08)", () => {
    // Clocks jump from 2:00 EST to 3:00 EDT.
    expect(siteLocalToUtcIso("2026-03-08T01:30")).toBe("2026-03-08T06:30:00.000Z");
    expect(siteLocalToUtcIso("2026-03-08T03:30")).toBe("2026-03-08T07:30:00.000Z");
    // An evening event that day is already on daylight time.
    expect(siteLocalToUtcIso("2026-03-08T18:00")).toBe("2026-03-08T22:00:00.000Z");
    // The Friday before is still on standard time.
    expect(siteLocalToUtcIso("2026-03-06T18:00")).toBe("2026-03-06T23:00:00.000Z");
  });

  it("maps a time that doesn't exist (skipped hour) to a neighbouring real instant", () => {
    // 2:30 AM never happens on 2026-03-08. Either 1:30 EST or 3:30 EDT is acceptable.
    expect(["2026-03-08T06:30:00.000Z", "2026-03-08T07:30:00.000Z"]).toContain(
      siteLocalToUtcIso("2026-03-08T02:30"),
    );
  });

  it("handles the fall-back day (2026-11-01)", () => {
    // Clocks go back from 2:00 EDT to 1:00 EST.
    expect(siteLocalToUtcIso("2026-11-01T00:30")).toBe("2026-11-01T04:30:00.000Z");
    expect(siteLocalToUtcIso("2026-11-01T03:00")).toBe("2026-11-01T08:00:00.000Z");
    expect(siteLocalToUtcIso("2026-11-01T18:00")).toBe("2026-11-01T23:00:00.000Z");
    // The Friday before is still on daylight time.
    expect(siteLocalToUtcIso("2026-10-30T18:00")).toBe("2026-10-30T22:00:00.000Z");
  });

  it("resolves the repeated 1:30 AM on fall-back day to the first (EDT) occurrence", () => {
    expect(siteLocalToUtcIso("2026-11-01T01:30")).toBe("2026-11-01T05:30:00.000Z");
  });

  it("ignores surrounding whitespace", () => {
    expect(siteLocalToUtcIso("  2026-10-23T18:30 ")).toBe("2026-10-23T22:30:00.000Z");
  });

  it.each(["", "2026-10-23", "2026-10-23 18:30", "18:30", "2026-10-23T18:30:00", "2026-10-23T18:30Z", "not a date"])(
    "returns null for malformed input %j",
    (value) => {
      expect(siteLocalToUtcIso(value)).toBeNull();
    },
  );

  // BUG (minor): the regex accepts impossible calendar values and Date.UTC rolls
  // them over silently, e.g. "2026-02-30T18:00" becomes March 2. Browsers never
  // send these from <input type="datetime-local">, but a hand-crafted form post
  // could. Expected: null. Remove `.fails` once siteLocalToUtcIso range-checks.
  it("returns null for impossible dates and times", () => {
    expect(siteLocalToUtcIso("2026-02-30T18:00")).toBeNull();
    expect(siteLocalToUtcIso("2026-13-01T10:00")).toBeNull();
    expect(siteLocalToUtcIso("2026-10-23T25:00")).toBeNull();
  });
});

describe("toDateTimeLocalValue", () => {
  it("formats an instant in site time", () => {
    expect(toDateTimeLocalValue("2026-10-23T22:30:00Z")).toBe("2026-10-23T18:30");
    expect(toDateTimeLocalValue(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-15T18:30");
  });

  it("uses 00 (not 24) for midnight", () => {
    expect(toDateTimeLocalValue("2026-10-24T04:00:00Z")).toBe("2026-10-24T00:00");
  });

  it("returns an empty string for missing values", () => {
    expect(toDateTimeLocalValue(null)).toBe("");
    expect(toDateTimeLocalValue(undefined)).toBe("");
    expect(toDateTimeLocalValue("")).toBe("");
  });

  it.each(["2026-10-23T18:30", "2026-01-15T07:05", "2026-03-08T03:30", "2026-11-01T00:30", "2026-11-01T18:00", "2026-12-31T23:59"])(
    "round-trips %s through siteLocalToUtcIso",
    (value) => {
      const iso = siteLocalToUtcIso(value);
      expect(iso).not.toBeNull();
      expect(toDateTimeLocalValue(iso)).toBe(value);
    },
  );
});

describe("formatting in Bethlehem time", () => {
  // 02:00 UTC on Saturday is still 10 PM Friday in Bethlehem.
  const lateFriday = "2026-10-24T02:00:00Z";

  it("formats times", () => {
    expect(plain(formatTime("2026-10-23T22:30:00Z"))).toBe("6:30 PM");
    expect(plain(formatTime(lateFriday))).toBe("10:00 PM");
    expect(plain(formatTime("2026-01-15T17:05:00Z"))).toBe("12:05 PM");
  });

  it("formats dates using the local calendar day", () => {
    expect(formatLongDate(lateFriday)).toBe("Friday, October 23");
    expect(formatShortDate(lateFriday)).toBe("Fri, Oct 23");
    expect(plain(formatDateTime(lateFriday))).toBe("Fri, Oct 23, 10:00 PM");
  });

  it("formats time ranges and falls back to the start time", () => {
    expect(plain(formatTimeRange("2026-10-23T22:30:00Z", "2026-10-24T01:00:00Z"))).toBe("6:30 PM – 9:00 PM");
    expect(plain(formatTimeRange("2026-10-23T22:30:00Z", null))).toBe("6:30 PM");
    expect(plain(formatTimeRange("2026-10-23T22:30:00Z"))).toBe("6:30 PM");
  });

  it("shows both dates when an event ends on another day in Bethlehem", () => {
    // Shabbaton: Friday 6 PM to Saturday 9 PM.
    expect(plain(formatTimeRange("2026-10-23T22:00:00Z", "2026-10-25T01:00:00Z"))).toBe(
      "Fri, Oct 23, 6:00 PM – Sat, Oct 24, 9:00 PM",
    );
    // Overnight program that ends after midnight local time.
    expect(plain(formatTimeRange("2026-10-24T01:00:00Z", "2026-10-24T05:00:00Z"))).toBe(
      "Fri, Oct 23, 9:00 PM – Sat, Oct 24, 1:00 AM",
    );
    expect(spansDays("2026-10-23T22:30:00Z", "2026-10-24T01:00:00Z")).toBe(false);
    expect(spansDays("2026-10-23T22:30:00Z", null)).toBe(false);
  });

  it("formats the date and time line for an event", () => {
    expect(plain(formatEventWhen("2026-10-23T22:30:00Z", "2026-10-24T01:00:00Z"))).toBe(
      "Friday, October 23 · 6:30 PM – 9:00 PM",
    );
    expect(plain(formatEventWhen("2026-10-23T22:00:00Z", "2026-10-25T01:00:00Z"))).toBe(
      "Fri, Oct 23, 6:00 PM – Sat, Oct 24, 9:00 PM",
    );
  });

  it("accepts strings, numbers and Dates", () => {
    const ms = Date.parse("2026-10-23T22:30:00Z");
    expect(plain(formatTime(ms))).toBe("6:30 PM");
    expect(plain(formatTime(new Date(ms)))).toBe("6:30 PM");
  });
});

describe("isPast", () => {
  const start = "2026-10-23T22:30:00Z";
  const end = "2026-10-24T01:00:00Z";

  it("uses the end time when there is one", () => {
    expect(isPast(start, end, new Date("2026-10-24T00:59:00Z"))).toBe(false);
    expect(isPast(start, end, new Date("2026-10-24T01:01:00Z"))).toBe(true);
  });

  it("treats an event with no end time as running for 3 hours", () => {
    expect(isPast(start, null, new Date("2026-10-24T01:29:00Z"))).toBe(false);
    expect(isPast(start, null, new Date("2026-10-24T01:31:00Z"))).toBe(true);
  });

  it("is false for future events", () => {
    expect(isPast(start, end, new Date("2026-10-20T12:00:00Z"))).toBe(false);
  });
});

describe("relativeDay", () => {
  // Friday, October 23, 10:00 AM in Bethlehem.
  const now = new Date("2026-10-23T14:00:00Z");

  it("says Today for later the same local day, even if UTC has rolled over", () => {
    expect(relativeDay("2026-10-23T22:30:00Z", now)).toBe("Today");
    expect(relativeDay("2026-10-24T03:30:00Z", now)).toBe("Today"); // 11:30 PM Friday
  });

  it("says Tomorrow and In N days", () => {
    expect(relativeDay("2026-10-24T16:00:00Z", now)).toBe("Tomorrow");
    expect(relativeDay("2026-10-26T16:00:00Z", now)).toBe("In 3 days");
    expect(relativeDay("2026-10-29T16:00:00Z", now)).toBe("In 6 days");
  });

  it("returns null a week or more away, and for past days", () => {
    expect(relativeDay("2026-10-30T16:00:00Z", now)).toBeNull();
    expect(relativeDay("2026-10-22T16:00:00Z", now)).toBeNull();
  });

  it("uses Bethlehem's calendar day late at night", () => {
    const lateFriday = new Date("2026-10-24T03:30:00Z"); // 11:30 PM Friday
    expect(relativeDay("2026-10-24T14:00:00Z", lateFriday)).toBe("Tomorrow");
  });

  it("works across the fall-back transition", () => {
    const saturdayNoon = new Date("2026-10-31T16:00:00Z"); // EDT
    expect(relativeDay("2026-11-01T17:00:00Z", saturdayNoon)).toBe("Tomorrow"); // EST
  });
});
