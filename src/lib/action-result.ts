import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";

/** Standard return shape for server actions used with useActionState. */
export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export const initialActionState = { ok: true } as ActionResult;

/** Friendly messages for the error codes raised by our database functions. */
const DB_ERROR_MESSAGES: Record<string, string> = {
  auth_required: "Please sign in first.",
  forbidden: "You don't have permission to do that.",
  rate_limited: "You're doing that a lot. Please wait a few minutes and try again.",
  event_not_found: "We couldn't find that event.",
  rsvp_closed: "RSVPs are closed for this event. Please contact the organizer.",
  event_ended: "This event has already ended.",
  rsvp_deadline_passed: "The RSVP deadline has passed. Please contact the organizer.",
  rsvp_declined: "An organizer has already responded to your RSVP. Please contact them directly.",
  too_many_guests: "That's more guests than this event allows.",
  guest_increase_needs_organizer: "Your guests are already confirmed. To bring more, please contact the organizer.",
  not_enough_capacity: "There isn't enough space for that change. Your current RSVP is unchanged.",
  invalid_response: "Please choose Going or Not going.",
  text_too_long: "That text is too long.",
  invalid_state: "That RSVP can't be changed that way.",
  rsvp_not_found: "We couldn't find that RSVP.",
  no_guests: "This RSVP has no guests.",
  last_admin: "You can't remove the last admin. Add another admin first.",
  invalid_email: "Please enter a valid email address.",
  invalid_decision: "Please choose Approve or Decline.",
  no_emails: "Add at least one email address.",
  too_many_emails: "Please invite up to 100 people at a time.",
  menu_locked: "Published menus can't be edited. Create a new version instead.",
  use_publish_menu: "Use the Publish button to publish a menu.",
  menu_not_found: "We couldn't find that menu.",
  menu_not_draft: "Only draft menus can be published.",
  menu_empty: "Add at least one dish before publishing.",
  dish_missing_ingredients: "Add ingredients to every dish before publishing, so people with allergies can check them.",
  prep_confirmation_required:
    "Please confirm that ingredients, allergens and cross-contact notes match how the food will be prepared.",
  change_summary_required: "Describe what changed so people with allergies can review it.",
  signup_closed: "Sign-ups are closed.",
  signup_full: "That's full.",
  shift_not_found: "We couldn't find that shift.",
  signup_not_found: "That person isn't signed up for this shift anymore.",
};

export function dbErrorMessage(error: PostgrestError | { message?: string; code?: string } | null): string {
  if (!error) return "Something went wrong. Please try again.";
  const msg = (error.message ?? "").trim();
  if (Object.hasOwn(DB_ERROR_MESSAGES, msg)) return DB_ERROR_MESSAGES[msg];
  if (error.code === "23505") return "That already exists.";
  if (error.code === "42501") return "You don't have permission to do that.";
  if (error.code === "23503") return "That item is still in use, so it can't be removed.";
  if (error.code === "23514") return "Some of the information isn't valid. Please check the form.";
  return "Something went wrong. Please try again.";
}

export function validationError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
}
