"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(80);

const rsvpSchema = z.object({
  event_id: z.guid(),
  slug,
  response: z.enum(["going", "not_going"], { message: "Please choose Going or Not going." }),
  guest_count: z.coerce.number().int().min(0).max(10).default(0),
  guest_names: z.string().trim().max(300, "Please keep guest names under 300 characters.").optional(),
  note: z.string().trim().max(500, "Please keep your note under 500 characters.").optional(),
});

function revalidateEvent(eventSlug: string) {
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath(`/events/${eventSlug}`);
  revalidatePath("/my-events");
}

/** Create or change the signed-in person's RSVP. Capacity/waitlist/approval rules run in SQL. */
export async function setRsvp(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };

  const parsed = rsvpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const input = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_rsvp", {
    p_event_id: input.event_id,
    p_response: input.response,
    p_guest_count: input.response === "going" ? input.guest_count : 0,
    p_guest_names: input.guest_names || undefined,
    p_note: input.note || undefined,
  });
  if (error || !data) return { ok: false, error: dbErrorMessage(error) };

  revalidateEvent(input.slug);

  const guestsPending = data.guest_status === "pending" && data.guest_count > 0;
  const messages: Record<string, string> = {
    going: guestsPending
      ? "You're going! Your guests are waiting for an organizer to confirm them."
      : "You're going! See you there.",
    waitlist:
      "This event is full right now, so you're on the waitlist. We'll confirm you automatically if a spot opens.",
    pending: "Thanks! An organizer will confirm your RSVP. We'll send you a notification.",
    not_going: "Thanks for letting us know. You can change your RSVP any time before the event.",
    declined: "An organizer has already responded to your RSVP. Please contact them with any questions.",
  };
  return { ok: true, message: messages[data.status] ?? "Your RSVP is saved." };
}

const mealSchema = z.object({
  event_id: z.guid(),
  slug,
  preference: z.string().trim().max(500, "Please keep this under 500 characters.").optional(),
  guest_dietary_notes: z.string().trim().max(500, "Please keep this under 500 characters.").optional(),
});

/** Save private, per-event meal notes (owner-only; kitchen staff see them in the dietary report). */
export async function saveMealPreference(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };

  const parsed = mealSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { event_id, slug: eventSlug, preference, guest_dietary_notes } = parsed.data;

  const supabase = await createClient();
  const { error } =
    !preference && !guest_dietary_notes
      ? await supabase.from("event_meal_preferences").delete().eq("event_id", event_id).eq("user_id", viewer.id)
      : await supabase.from("event_meal_preferences").upsert(
          { event_id, user_id: viewer.id, preference: preference || null, guest_dietary_notes: guest_dietary_notes || null },
          { onConflict: "event_id,user_id" },
        );
  if (error) return { ok: false, error: dbErrorMessage(error) };

  revalidatePath(`/events/${eventSlug}`);
  return { ok: true, message: "Saved. Only you and our kitchen staff/admins can see this." };
}
