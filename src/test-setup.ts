import { vi } from "vitest";

// The unit tests check time and calendar logic against one fixed community (New York time),
// so they pass whatever a copy of the app puts in src/config/site.ts.
vi.mock("@/config/site", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/site")>();
  return { ...actual, SITE: { ...actual.SITE, slug: "chabad-at-lehigh", timeZone: "America/New_York" } };
});
