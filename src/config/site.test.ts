import { describe, expect, it, vi } from "vitest";

// src/test-setup.ts pins the slug and time zone for the logic tests; these check the real values.
const real = () => vi.importActual<typeof import("@/config/site")>("@/config/site");

describe("site config", () => {
  it("has a time zone that dates can be shown in", async () => {
    const { SITE } = await real();
    expect(() => new Intl.DateTimeFormat("en-US", { timeZone: SITE.timeZone })).not.toThrow();
  });

  it("has a slug of lowercase letters, numbers and dashes", async () => {
    const { SITE } = await real();
    expect(SITE.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("has at least one student email domain, without @", async () => {
    const { SITE } = await real();
    expect(SITE.campus.studentEmailDomains.length).toBeGreaterThan(0);
    for (const domain of SITE.campus.studentEmailDomains) expect(domain).toMatch(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/);
  });
});
