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
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidate(g.data.eventId);
  return { ok: true, message: decision === "approve" ? "Guests confirmed." : "Guests declined." };
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
