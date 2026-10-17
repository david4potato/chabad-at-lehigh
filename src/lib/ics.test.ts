import { describe, expect, it } from "vitest";
import { icsEscape, icsFold, icsStamp } from "./ics";

describe("icsEscape", () => {
  it("escapes semicolons and commas with a backslash", () => {
    expect(icsEscape("Dinner; bring a friend, ok")).toBe("Dinner\\; bring a friend\\, ok");
  });

  it("escapes backslashes first, then newlines", () => {
    expect(icsEscape("a;b,c\\d\ne")).toBe("a\\;b\\,c\\\\d\\ne");
    expect(icsEscape("line one\r\nline two")).toBe("line one\\nline two");
  });

  it("leaves plain text alone", () => {
    expect(icsEscape("Shabbat Dinner")).toBe("Shabbat Dinner");
  });
});

describe("icsStamp", () => {
  it("formats a UTC timestamp without separators or milliseconds", () => {
    expect(icsStamp(new Date("2026-10-23T22:30:00.000Z"))).toBe("20261023T223000Z");
  });
});

describe("icsFold", () => {
  const octets = (s: string) => new TextEncoder().encode(s).length;

  it("leaves short lines unchanged", () => {
    expect(icsFold("SUMMARY:Shabbat Dinner")).toBe("SUMMARY:Shabbat Dinner");
  });

  it("folds long lines to 75 octets, continuing with a space", () => {
    const line = `DESCRIPTION:${"x".repeat(200)}`;
    const folded = icsFold(line);
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) expect(octets(part)).toBeLessThanOrEqual(75);
    expect(parts.slice(1).every((p) => p.startsWith(" "))).toBe(true);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });

  it("never splits a multi-byte character", () => {
    const line = `SUMMARY:${"é".repeat(60)}`;
    const parts = icsFold(line).split("\r\n");
    for (const part of parts) expect(octets(part)).toBeLessThanOrEqual(75);
    expect(parts.map((p, i) => (i === 0 ? p : p.slice(1))).join("")).toBe(line);
  });
});
