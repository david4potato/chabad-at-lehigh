"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";
import { ALLERGEN_CODES, DIET_CODES } from "@/lib/allergens";
import { safeNextPath } from "@/lib/safe-redirect";

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .transform((v) => v || null);

const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter your name.").max(120, "That name is too long."),
  preferred_name: optional(60),
  affiliation: z.enum(["student", "community", "alumni", "parent", "faculty_staff", "other"], {
    message: "Please choose one.",
  }),
  class_year: z
    .union([z.literal(""), z.coerce.number().int().min(1950, "Enter a 4-digit year.").max(2100, "Enter a 4-digit year.")])
    .optional()
    .transform((v) => (v === "" || v === undefined ? null : v)),
  phone: optional(40),
});

async function updateProfile(formData: FormData, markOnboarded: boolean): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ ...parsed.data, ...(markOnboarded ? { onboarded_at: new Date().toISOString() } : {}) })
    .eq("id", viewer.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Saved." };
}

/** First-time welcome form; continues to the (optional) dietary step. */
export async function completeWelcome(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const result = await updateProfile(formData, true);
  if (!result.ok) return result;
  const next = safeNextPath(String(formData.get("next") ?? ""), "/");
  redirect(`/profile/dietary?welcome=1&next=${encodeURIComponent(next)}`);
}

export async function saveProfile(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const result = await updateProfile(formData, false);
  return result.ok ? { ok: true, message: "Your profile is saved." } : result;
}

const severity = z.enum(["intolerance", "allergy", "severe"]);

const dietarySchema = z.object({
  allergens: z
    .array(
      z.object({
        code: z.enum(ALLERGEN_CODES as [string, ...string[]]),
        severity,
        notes: z.string().trim().max(300, "Please keep notes under 300 characters.").optional(),
      }),
    )
    .max(ALLERGEN_CODES.length),
  diets: z.array(z.enum(DIET_CODES as [string, ...string[]])).max(DIET_CODES.length),
  other_restrictions: optional(1000),
  notes_for_kitchen: optional(1000),
  carries_epinephrine: z.boolean(),
  share_with_kitchen: z.boolean(),
});

/** Save the private dietary profile and sync the allergen list. */
export async function saveDietary(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };

  const selected = formData.getAll("allergen").map(String);
  const parsed = dietarySchema.safeParse({
    allergens: selected.map((code) => ({
      code,
      severity: String(formData.get(`severity_${code}`) ?? "allergy"),
      notes: String(formData.get(`notes_${code}`) ?? ""),
    })),
    diets: formData.getAll("diet").map(String),
    other_restrictions: String(formData.get("other_restrictions") ?? ""),
    notes_for_kitchen: String(formData.get("notes_for_kitchen") ?? ""),
    carries_epinephrine: formData.get("carries_epinephrine") === "on",
    share_with_kitchen: formData.get("share_with_kitchen") === "on",
  });
  if (!parsed.success) return validationError(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { error: profileError } = await supabase.from("dietary_profiles").upsert(
    {
      user_id: viewer.id,
      diets: d.diets,
      other_restrictions: d.other_restrictions,
      notes_for_kitchen: d.notes_for_kitchen,
      carries_epinephrine: d.carries_epinephrine,
      share_with_kitchen: d.share_with_kitchen,
    },
    { onConflict: "user_id" },
  );
  if (profileError) return { ok: false, error: dbErrorMessage(profileError) };

  const codes = d.allergens.map((a) => a.code);
  let remove = supabase.from("user_allergens").delete().eq("user_id", viewer.id);
  if (codes.length > 0) remove = remove.not("allergen_code", "in", `(${codes.join(",")})`);
  const { error: removeError } = await remove;
  if (removeError) return { ok: false, error: dbErrorMessage(removeError) };

  if (codes.length > 0) {
    const { error } = await supabase.from("user_allergens").upsert(
      d.allergens.map((a) => ({
        user_id: viewer.id,
        allergen_code: a.code,
        severity: a.severity as z.infer<typeof severity>,
        notes: a.notes || null,
      })),
      { onConflict: "user_id,allergen_code" },
    );
    if (error) return { ok: false, error: dbErrorMessage(error) };
  }

  revalidatePath("/", "layout");
  const next = formData.get("next");
  if (formData.get("welcome") === "1" && typeof next === "string") redirect(safeNextPath(next, "/"));
  return {
    ok: true,
    message: d.share_with_kitchen
      ? "Saved. Only you — and kitchen staff/admins for events you RSVP to — can see this."
      : "Saved. Only you can see this. Please tell the organizer directly about anything the kitchen needs to know.",
  };
}

/** Permanently delete the viewer's dietary profile, allergens and per-event meal notes. */
export async function deleteDietary(): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };
  const supabase = await createClient();
  const results = await Promise.all([
    supabase.from("user_allergens").delete().eq("user_id", viewer.id),
    supabase.from("event_meal_preferences").delete().eq("user_id", viewer.id),
    supabase.from("dietary_profiles").delete().eq("user_id", viewer.id),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: dbErrorMessage(failed.error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Your dietary information has been deleted." };
}

/** Mark all of the viewer's notifications as read. */
export async function markAllNotificationsRead(): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read", {});
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteNotification(id: string): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer || !z.guid().safeParse(id).success) return { ok: false, error: "Please sign in first." };
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").delete().eq("id", id).eq("user_id", viewer.id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/notifications");
  return { ok: true };
}

/** Permanently delete the signed-in person's account and everything tied to it. */
export async function deleteAccount(): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Please sign in first." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account");
  if (error) {
    return {
      ok: false,
      error:
        error.message === "last_admin"
          ? "You're the only admin. Make someone else an admin first (Dashboard → People & roles)."
          : dbErrorMessage(error),
    };
  }
  await supabase.auth.signOut({ scope: "local" });
  revalidatePath("/", "layout");
  redirect("/?account_deleted=1");
}
