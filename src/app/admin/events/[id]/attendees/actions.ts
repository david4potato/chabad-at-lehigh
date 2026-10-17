"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";

const ORGANIZERS = ["organizer", "admin"] as const;
const input = z.object({
  eventId: z.guid(),
  rsvpId: z.guid(),
  decision: z.enum(["approve", "decline"]),
  override: z.boolean().default(false),
});

async function guard(raw: unknown) {
  if (!(await viewerWithRole(ORGANIZERS))) return { error: "You don't have permission to do that." } as const;
  const parsed = input.safeParse(raw);
  if (!parsed.success) return { error: "Something didn't look right. Please refresh and try again." } as const;
  return { data: parsed.data } as const;
}

function revalidate(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/attendees`);
  revalidatePath("/admin", "layout");
  revalidatePath("/events", "layout");
  revalidatePath("/");
}

export async function decideRsvp(eventId: string, rsvpId: string, decision: "approve" | "decline", override = false): Promise<ActionResult> {
  const g = await guard({ eventId, rsvpId, decision, override });
  if ("error" in g) return { ok: false, error: g.error! };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_decide_rsvp", {
    p_rsvp_id: g.data.rsvpId,
    p_decision: g.data.decision,
    p_override_capacity: g.data.override,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidate(g.data.eventId);
  if (decision === "decline") return { ok: true, message: "RSVP declined. They've been notified." };
  return {
    ok: true,
    message: data?.status === "waitlist" ? "The event is full, so they were added to the waitlist." : "Confirmed. They've been notified.",
  };
}

export async function decideGuests(eventId: string, rsvpId: string, decision: "approve" | "decline", override = false): Promise<ActionResult> {
  const g = await guard({ eventId, rsvpId, decision, override });
  if ("error" in g) return { ok: false, error: g.error! };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_decide_guests", {
    p_rsvp_id: g.data.rsvpId,
    p_decision: g.data.decision,
    p_override_capacity: g.data.override,
  });
  if (error?.message === "not_enough_capacity") {
    // Refresh the list so the over-capacity option shows for this row.
    revalidate(g.data.eventId);
    return { ok: false, error: "There isn't room for these guests. You can approve them anyway (over capacity) or decline them." };
  }
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidate(g.data.eventId);
  return { ok: true, message: decision === "approve" ? "Guests confirmed." : "Guests declined." };
}

/** Mark someone as not going on their behalf (e.g. they texted that they can't come). Frees the seat for the waitlist. */
export async function cancelRsvp(eventId: string, rsvpId: string): Promise<ActionResult> {
  const g = await guard({ eventId, rsvpId, decision: "decline" });
  if ("error" in g) return { ok: false, error: g.error! };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_cancel_rsvp", { p_rsvp_id: g.data.rsvpId });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidate(g.data.eventId);
  return { ok: true, message: "RSVP cancelled. They've been notified." };
}

export async function setCheckIn(eventId: string, rsvpId: string, checkedIn: boolean): Promise<ActionResult> {
  const g = await guard({ eventId, rsvpId, decision: "approve" });
  if ("error" in g) return { ok: false, error: g.error! };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_set_check_in", { p_rsvp_id: g.data.rsvpId, p_checked_in: checkedIn });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath(`/admin/events/${g.data.eventId}/attendees`);
  return { ok: true };
}

export type InviteResult = ActionResult<{ email: string; result: string }[]>;

/**
 * Pasted text to a list of addresses. A list copied from an email client
 * ("Sarah Cohen" <sarah@lehigh.edu>, ...) keeps only the addresses. Otherwise every
 * word is kept, so typos come back as "not a valid email" instead of vanishing.
 */
function parseEmailList(text: string): string[] {
  const clean = (t: string) => t.trim().replace(/^[<"'(\[]+|[>"')\]:.,;]+$/g, "").toLowerCase();
  const tokens = text.includes("<")
    ? [
        ...Array.from(text.matchAll(/<([^<>]*)>/g), (m) => m[1]),
        ...text.replace(/<[^<>]*>/g, " ").split(/[\s,;]+/).filter((t) => t.includes("@")),
      ]
    : text.split(/[\s,;]+/);
  return [...new Set(tokens.map(clean).filter(Boolean))];
}

/** Send in-app invitations to members by email (organizers/admins). */
export async function invitePeople(_prev: InviteResult, formData: FormData): Promise<InviteResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return { ok: false, error: "You don't have permission to do that." };
  const parsed = z
    .object({
      event_id: z.guid(),
      emails: z.string().trim().min(3, "Add at least one email address.").max(5000),
      message: z.string().trim().max(500, "Please keep the message under 500 characters.").optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const emails = parseEmailList(parsed.data.emails);
  if (emails.length === 0) return { ok: false, error: "Add at least one email address." };
  if (emails.length > 100) return { ok: false, error: "Please invite up to 100 people at a time." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("staff_invite_to_event", {
    p_event_id: parsed.data.event_id,
    p_emails: emails,
    p_message: parsed.data.message || undefined,
  });
  if (error) {
    return {
      ok: false,
      error: error.message === "event_not_found" ? "Publish the event before inviting people." : dbErrorMessage(error),
    };
  }
  const invited = (data ?? []).filter((r) => r.result === "invited").length;
  return { ok: true, message: `${invited} ${invited === 1 ? "person" : "people"} invited.`, data: data ?? [] };
}
