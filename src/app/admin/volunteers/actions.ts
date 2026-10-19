"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";
import { siteLocalToUtcIso } from "@/lib/time";
import { repeatStarts } from "@/lib/recurrence";
import { hasStarted } from "@/lib/data/volunteer";

const ORGANIZERS = ["organizer", "admin"] as const;
const FORBIDDEN: ActionResult = { ok: false, error: "You don't have permission to do that." };
const NOT_FOUND: ActionResult = { ok: false, error: "We couldn't find that shift." };

const localDateTime = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const iso = siteLocalToUtcIso(v);
    if (!iso) {
      ctx.addIssue({ code: "custom", message: "Please enter a valid date and time." });
      return z.NEVER;
    }
    return iso;
  });

const shiftSchema = z
  .object({
    title: z.string().trim().min(3, "Please enter a title (3+ characters).").max(140, "Please keep the title under 140 characters."),
    event_id: z
      .union([z.literal(""), z.guid("Please choose an event from the list.")])
      .optional()
      .transform((v) => v || null),
    starts_at: localDateTime.refine((v) => v !== null, "Please enter a start date and time."),
    ends_at: localDateTime,
    slots: z.coerce
      .number({ message: "Please enter a number." })
      .int("Whole numbers only.")
      .min(1, "At least 1 spot.")
      .max(500, "Up to 500 spots."),
    description: z
      .string()
      .trim()
      .max(2000, "Please keep this under 2,000 characters.")
      .optional()
      .transform((v) => v || null),
    status: z.enum(["draft", "open", "closed"], { message: "Please choose a status." }),
  })
  .superRefine((v, ctx) => {
    if (v.ends_at && v.starts_at && v.ends_at < v.starts_at) {
      ctx.addIssue({ code: "custom", path: ["ends_at"], message: "The end must be after the start." });
    }
  });

function parseShiftForm(formData: FormData) {
  return shiftSchema.safeParse(Object.fromEntries(formData));
}

function saveError(error: { code?: string; message?: string }): ActionResult {
  // A bad event id fails the foreign key; say so instead of the generic "still in use".
  if (error.code === "23503") return { ok: false, error: "We couldn't find that event.", fieldErrors: { event_id: ["Please choose an event from the list."] } };
  return { ok: false, error: dbErrorMessage(error) };
}

function revalidateShifts(id?: string) {
  revalidatePath("/admin/volunteers");
  if (id) revalidatePath(`/admin/volunteers/${id}`);
  revalidatePath("/volunteer");
  revalidatePath("/events/[slug]", "page");
}

const repeatWeeks = z.coerce.number().int().min(0).max(12).catch(0);

export async function createShift(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return FORBIDDEN;
  const parsed = parseShiftForm(formData);
  if (!parsed.success) return validationError(parsed.error);
  const values = { ...parsed.data, starts_at: parsed.data.starts_at! };
  // Only for shifts on their own: a weekly copy tied to the same event would land on the wrong day.
  const more = repeatWeeks.parse(formData.get("repeat_weeks") ?? 0);
  if (more > 0 && values.event_id) {
    return {
      ok: false,
      error: "Please fix the highlighted fields.",
      fieldErrors: { repeat_weeks: ["Shifts on an event can't repeat. Repeat the event instead, and its shifts come along."] },
    };
  }

  const supabase = await createClient();
  if (more > 0) {
    // Each week at the same clock time; the end moves with the start.
    const length = values.ends_at ? new Date(values.ends_at).getTime() - new Date(values.starts_at).getTime() : null;
    const starts = [values.starts_at, ...repeatStarts(values.starts_at, 1, more, new Date(values.starts_at))];
    const { error } = await supabase.from("volunteer_shifts").insert(
      starts.map((s) => ({ ...values, starts_at: s, ends_at: length === null ? null : new Date(new Date(s).getTime() + length).toISOString() })),
    );
    if (error) return saveError(error);
    revalidateShifts();
    redirect(`/admin/volunteers?added=${starts.length}`);
  }
  const { data, error } = await supabase.from("volunteer_shifts").insert(values).select("id").single();
  if (error) return saveError(error);
  revalidateShifts(data.id);
  redirect(`/admin/volunteers/${data.id}?saved=1`);
}

export async function updateShift(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return FORBIDDEN;
  const id = String(formData.get("id") ?? "");
  if (!z.guid().safeParse(id).success) return NOT_FOUND;
  const parsed = parseShiftForm(formData);
  if (!parsed.success) return validationError(parsed.error);
  const values = parsed.data;

  const supabase = await createClient();
  // The old times and the sign-up count, only to say whether people get told (the trigger does the telling).
  const [{ data: before }, { count: signups }] = await Promise.all([
    supabase.from("volunteer_shifts").select("starts_at, ends_at").eq("id", id).maybeSingle(),
    supabase.from("volunteer_signups").select("user_id", { count: "exact", head: true }).eq("shift_id", id),
  ]);
  if (!before) return NOT_FOUND;
  const { data, error } = await supabase
    .from("volunteer_shifts")
    .update({ ...values, starts_at: values.starts_at! })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) return saveError(error);
  if (!data) return NOT_FOUND;
  revalidateShifts(id);
  const time = (v: string | null) => (v ? new Date(v).getTime() : null);
  const timeChanged = time(before.starts_at) !== time(values.starts_at) || time(before.ends_at) !== time(values.ends_at);
  // Matches the database trigger: only shifts that hadn't started yet notify.
  if (timeChanged && (signups ?? 0) > 0 && !hasStarted(before.starts_at)) {
    return { ok: true, message: "Shift saved. People signed up get a notification about the new time." };
  }
  return { ok: true, message: "Shift saved." };
}

const removeSchema = z.object({ shiftId: z.guid(), userId: z.guid() });

/** Take someone off a shift (they can't come, or didn't show). They get a notification. */
export async function removeSignup(shiftId: string, userId: string): Promise<ActionResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return FORBIDDEN;
  const parsed = removeSchema.safeParse({ shiftId, userId });
  if (!parsed.success) return { ok: false, error: "We couldn't find that sign-up." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_remove_signup", {
    p_shift_id: parsed.data.shiftId,
    p_user_id: parsed.data.userId,
  });
  // Already gone (removed in another tab, or they pressed "Can't make it"): refresh the list either way.
  revalidateShifts(parsed.data.shiftId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  return { ok: true, message: "Removed. They get a notification, and their spot is open again." };
}

export async function deleteShift(id: string): Promise<ActionResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return FORBIDDEN;
  if (!z.guid().safeParse(id).success) return NOT_FOUND;
  const supabase = await createClient();
  // Sign-ups are deleted with the shift; count them first, only to say whether people get told.
  const { count: signups } = await supabase
    .from("volunteer_signups")
    .select("user_id", { count: "exact", head: true })
    .eq("shift_id", id);
  const { data, error } = await supabase.from("volunteer_shifts").delete().eq("id", id).select("id, starts_at");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  if (!data?.length) return NOT_FOUND;
  revalidateShifts();
  // Matches the database trigger: only shifts that hadn't started yet notify.
  const notified = (signups ?? 0) > 0 && !hasStarted(data[0].starts_at);
  redirect(`/admin/volunteers?deleted=${notified ? "notified" : "1"}`);
}
