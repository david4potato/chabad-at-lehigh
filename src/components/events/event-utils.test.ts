import { describe, expect, it } from "vitest";
import { CATEGORY_FILTERS, isEventCategory } from "./event-utils";

describe("isEventCategory", () => {
  it("accepts every real category", () => {
    for (const { value } of CATEGORY_FILTERS) expect(isEventCategory(value)).toBe(true);
  });

  it.each(["constructor", "__proto__", "toString", "hasOwnProperty", "", "Holiday", "shabbat dinner"])(
    "rejects %j",
    (value) => {
      expect(isEventCategory(value)).toBe(false);
    },
  );

  it("rejects non-strings", () => {
    for (const value of [undefined, null, 1, ["holiday"], { holiday: true }]) expect(isEventCategory(value)).toBe(false);
  });
});
