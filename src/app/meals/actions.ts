"use server";

import { z } from "zod";
import type { PostgrestError } from "@supabase/supabase-js";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";

// Favorites (event_id null) and per-event option votes live in dish_votes.
// RLS makes sure people only add/remove their own votes, only on active or
// proposed dishes, and only while an event's voting is open.
//
// No revalidatePath here: the vote buttons and suggestion form keep their own
// state, and nothing is cached on the server, so re-rendering the page would
// only add database calls.

const id = z.guid();

type VoteResult = ActionResult<{ active: boolean }>;

function voteError(error: PostgrestError, closedMessage: string): VoteResult {
  // 42501 = the insert policy said no (voting closed, or the dish is no longer offered).
  return { ok: false, error: error.code === "42501" ? closedMessage : dbErrorMessage(error) };
}

/** Add or remove a vote row for the signed-in person. Returns whether the vote is now on. */
async function toggleVote(dishId: string, eventId: string | null, closedMessage: string): Promise<VoteResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };

  const supabase = await createClient();
  let remove = supabase.from("dish_votes").delete().eq("user_id", viewer.id).eq("dish_id", dishId);
  remove = eventId ? remove.eq("event_id", eventId) : remove.is("event_id", null);
  const { data: removed, error: removeError } = await remove.select("id");
  if (removeError) return { ok: false, error: dbErrorMessage(removeError) };

  let active = false;
  if (!removed?.length) {
    const { error } = await supabase.from("dish_votes").insert({ dish_id: dishId, event_id: eventId });
    // 23505: already voted (e.g. a double tap) — that's the state we wanted.
    if (error && error.code !== "23505") return voteError(error, closedMessage);
    active = true;
  }

  return { ok: true, data: { active } };
}

/** Heart a dish (general favorites, not tied to an event). */
export async function toggleFavorite(dishId: string): Promise<VoteResult> {
  const parsed = id.safeParse(dishId);
  if (!parsed.success) return { ok: false, error: "We couldn't find that dish." };
  return toggleVote(parsed.data, null, "Favorites aren't available for this dish right now.");
}

/** Vote for a proposed dish on an event with menu voting open. */
export async function toggleOptionVote(eventId: string, dishId: string): Promise<VoteResult> {
  const parsed = z.object({ eventId: id, dishId: id }).safeParse({ eventId, dishId });
  if (!parsed.success) return { ok: false, error: "We couldn't find that dish." };
  return toggleVote(parsed.data.dishId, parsed.data.eventId, "Voting is closed for this menu.");
}

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .optional()
    .transform((v) => v || null);

const suggestionSchema = z.object({
  event_id: z
    .union([id, z.literal("")])
    .optional()
    .transform((v) => v || null),
  kind: z.enum(["dish", "ingredient", "feedback"], { message: "Please choose a type." }),
  title: z
    .string({ message: "Please add a short title." })
    .trim()
    .min(2, "Please add a short title (at least 2 characters).")
    .max(120, "Please keep the title under 120 characters."),
  details: optionalText(1000, "Please keep details under 1,000 characters."),
});

/** Suggest a dish, an ingredient, or share feedback. Staff review these in Admin → Suggestions. */
export async function submitSuggestion(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };

  const parsed = suggestionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { event_id, kind, title, details } = parsed.data;
  const { error } = await supabase.from("dish_suggestions").insert({ event_id, kind, title, details });
  if (error) return { ok: false, error: dbErrorMessage(error) };

  return { ok: true, message: "Thanks! Our team reviews every suggestion." };
}
