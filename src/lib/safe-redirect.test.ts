import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it.each([
    "https://evil.example",
    "http://evil.example/events",
    "//evil.example",
    "///evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/events\\..\\admin",
    "%2F%2Fevil.example",
    "/%2Fevil.example",
    "%2f%2fevil.example",
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "data:text/html,hi",
    "events",
    "/auth/callback?code=1",
    "/auth/sign-out",
    "/sign-in",
    "/sign-in?next=/admin",
    "/events\u0000",
    "/events%0d%0aSet-Cookie:x=1",
    "/%E0%A4%A",
  ])("rejects %j", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it.each(["/events?x=1", "/", "/events/shabbat-dinner", "/admin/events/123/menu", "/my-events#upcoming"])(
    "accepts %j",
    (value) => {
      expect(safeNextPath(value)).toBe(value);
    },
  );

  it("decodes a once-encoded local path", () => {
    expect(safeNextPath("%2Fevents%3Fx%3D1")).toBe("/events?x=1");
  });

  it("trims whitespace", () => {
    expect(safeNextPath("  /events  ")).toBe("/events");
  });

  it("uses the fallback for empty or missing values", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath(null, "/events")).toBe("/events");
    expect(safeNextPath("https://evil.example", "/events")).toBe("/events");
  });

  it("rejects very long values", () => {
    expect(safeNextPath(`/${"a".repeat(600)}`)).toBe("/");
  });

  // BUG (minor): the value is percent-decoded and the *decoded* string is
  // returned. Next.js already decodes searchParams once, so legitimately encoded
  // characters get decoded a second time and change meaning ("%23" becomes a
  // fragment, "%26" splits a query value). Safe, but lossy. A fix is to run the
  // checks on the decoded value but return the original (trimmed) one when it
  // already starts with "/". Remove `.fails` once fixed.
  it("keeps percent-encoded characters inside a query string", () => {
    expect(safeNextPath("/events?q=a%26b")).toBe("/events?q=a%26b");
  });
});
