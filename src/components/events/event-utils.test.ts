import { describe, expect, it } from "vitest";
import { CATEGORY_FILTERS, approvalNote, guestApprovalNote, isEventCategory } from "./event-utils";

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

describe("approval notes", () => {
  it("explains approval of the person's own RSVP only when it applies", () => {
    expect(approvalNote("auto", true)).toBeNull();
    expect(approvalNote("auto", false)).toBeNull();
    expect(approvalNote("guests_need_approval", true)).toBeNull();
    expect(approvalNote("guests_need_approval", false)).toMatch(/community guests are confirmed/i);
    expect(approvalNote("all_need_approval", true)).toMatch(/confirms each rsvp/i);
  });

  it("explains guest approval in the guest box", () => {
    expect(guestApprovalNote("auto")).toBeNull();
    expect(guestApprovalNote("all_need_approval")).toBeNull();
    expect(guestApprovalNote("guests_need_approval")).toBe("Guests you bring are confirmed by an organizer.");
  });
});
