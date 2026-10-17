"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";

const shiftId = z.guid();
const NOT_FOUND: ActionResult = { ok: false, error: "We couldn't find that shift." };

/** Refresh every page that shows shifts: Help out, event pages and the dashboard. */
function revalidateShift(id: string) {
  revalidatePath("/volunteer");
  revalidatePath("/events/[slug]", "page");
  revalidatePath("/admin/volunteers");
  revalidatePath(`/admin/volunteers/${id}`);
}

/** Sign the signed-in person up for a shift. Open/started/full checks run in SQL. */
export async function signUp(id: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };
  if (!shiftId.safeParse(id).success) return NOT_FOUND;

  const supabase = await createClient();
  const { error } = await supabase.from("volunteer_signups").insert({ shift_id: id, user_id: viewer.id });
  // Already signed up (double tap): that's the outcome they wanted.
  if (error && error.code !== "23505") {
    revalidateShift(id);
    return { ok: false, error: dbErrorMessage(error) };
  }
  revalidateShift(id);
  return { ok: true, message: "You're signed up. Thank you for helping!" };
}

/** Take the signed-in person off a shift. */
export async function cancelSignup(id: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };
  if (!shiftId.safeParse(id).success) return NOT_FOUND;

  const supabase = await createClient();
  const { error } = await supabase.from("volunteer_signups").delete().eq("shift_id", id).eq("user_id", viewer.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateShift(id);
  return { ok: true, message: "Thanks for letting us know. Your spot is open for someone else." };
}
