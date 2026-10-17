import { describe, expect, it } from "vitest";
import { z } from "zod";
import { dbErrorMessage, initialActionState, validationError } from "./action-result";

const GENERIC = "Something went wrong. Please try again.";

describe("dbErrorMessage", () => {
  it("maps error codes raised by our database functions", () => {
    expect(dbErrorMessage({ message: "auth_required" })).toBe("Please sign in first.");
    expect(dbErrorMessage({ message: "rsvp_closed", code: "P0001" })).toBe(
      "RSVPs are closed for this event. Please contact the organizer.",
    );
    expect(dbErrorMessage({ message: "prep_confirmation_required" })).toMatch(/confirm/);
    expect(dbErrorMessage({ message: "last_admin" })).toMatch(/last admin/);
  });

  it("ignores surrounding whitespace in the message", () => {
    expect(dbErrorMessage({ message: "  forbidden \n" })).toBe("You don't have permission to do that.");
  });

  it.each([
    ["23505", "That already exists."],
    ["42501", "You don't have permission to do that."],
    ["23503", "That item is still in use, so it can't be removed."],
    ["23514", "Some of the information isn't valid. Please check the form."],
  ])("maps Postgres code %s", (code, expected) => {
    expect(dbErrorMessage({ code, message: 'duplicate key value violates unique constraint "x"' })).toBe(expected);
  });

  it("prefers a known message over the Postgres code", () => {
    expect(dbErrorMessage({ code: "42501", message: "rate_limited" })).toMatch(/wait a few minutes/);
  });

  it("falls back to a generic message and never leaks raw details", () => {
    const raw = 'relation "private.secret_table" does not exist';
    const result = dbErrorMessage({ code: "42P01", message: raw });
    expect(result).toBe(GENERIC);
    expect(result).not.toContain("secret_table");
    expect(dbErrorMessage({ message: "something_new" })).toBe(GENERIC);
    expect(dbErrorMessage({})).toBe(GENERIC);
    expect(dbErrorMessage(null)).toBe(GENERIC);
  });

  it("does not match inherited object keys", () => {
    expect(dbErrorMessage({ message: "toString" })).toBe(GENERIC);
    expect(dbErrorMessage({ message: "constructor" })).toBe(GENERIC);
  });
});

describe("validationError", () => {
  const schema = z
    .object({
      name: z.string().min(1, "Please enter a name."),
      guests: z.array(z.object({ email: z.email("Please enter a valid email.") })),
      start: z.string(),
      end: z.string(),
    })
    .refine((v) => v.end >= v.start, { message: "End must be after start." });

  it("collects errors by dotted field path", () => {
    const result = schema.safeParse({ name: "", guests: [{ email: "ok@example.com" }, { email: "nope" }], start: "b", end: "c" });
    expect(result.success).toBe(false);
    if (result.success) return;

    expect(validationError(result.error)).toEqual({
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: {
        name: ["Please enter a name."],
        "guests.1.email": ["Please enter a valid email."],
      },
    });
  });

  it("puts errors without a path under _form", () => {
    const result = schema.safeParse({ name: "A", guests: [], start: "b", end: "a" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(validationError(result.error).ok).toBe(false);
    expect(validationError(result.error)).toMatchObject({ fieldErrors: { _form: ["End must be after start."] } });
  });

  it("keeps every message for a field", () => {
    const multi = z.object({
      code: z.string().min(6, "Too short.").regex(/^\d+$/, "Digits only."),
    });
    const result = multi.safeParse({ code: "ab" });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(validationError(result.error)).toMatchObject({ fieldErrors: { code: ["Too short.", "Digits only."] } });
  });
});

describe("initialActionState", () => {
  it("starts as a neutral success with no message", () => {
    expect(initialActionState).toEqual({ ok: true });
  });
});
