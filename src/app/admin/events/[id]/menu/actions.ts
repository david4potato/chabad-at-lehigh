"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";
import { ALLERGEN_CODES } from "@/lib/allergens";

const MENU_STAFF = ["organizer", "kitchen_staff", "admin"] as const;
const FORBIDDEN: ActionResult = { ok: false, error: "You don't have permission to do that." };
const id = z.guid();
const COURSES = ["appetizer", "soup", "salad", "bread", "main", "side", "dessert", "drink", "other"] as const;
const text = (max: number) => z.string().trim().max(max, `Please keep this under ${max} characters.`).optional().transform((v) => v || null);

async function eventSlug(eventId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("slug").eq("id", eventId).maybeSingle();
  return data?.slug ?? null;
}

async function revalidate(eventId: string) {
  revalidatePath(`/admin/events/${eventId}/menu`);
  const slug = await eventSlug(eventId);
  if (slug) revalidatePath(`/events/${slug}`);
  revalidatePath("/");
}

export async function startDraft(eventId: string): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  if (!id.safeParse(eventId).success) return { ok: false, error: "Event not found." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_menu_draft", { p_event_id: eventId, p_copy_published: true });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  await revalidate(eventId);
  redirect(`/admin/events/${eventId}/menu?notice=started`);
}

export async function discardDraft(eventId: string, versionId: string): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  if (!id.safeParse(eventId).success || !id.safeParse(versionId).success) return { ok: false, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("menu_versions").delete().eq("id", versionId).eq("status", "draft");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  await revalidate(eventId);
  redirect(`/admin/events/${eventId}/menu?notice=discarded`);
}

export async function saveDraftDetails(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  const parsed = z
    .object({ event_id: id, version_id: id, title: text(140), kitchen_notes: text(2000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_versions")
    .update({ title: parsed.data.title, kitchen_notes: parsed.data.kitchen_notes })
    .eq("id", parsed.data.version_id)
    .eq("status", "draft");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  await revalidate(parsed.data.event_id);
  return { ok: true, message: "Saved." };
}

export async function addMenuItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  const parsed = z
    .object({ event_id: id, version_id: id, dish_id: id, course: z.enum(COURSES).optional() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please choose a dish." };
  const supabase = await createClient();
  const [{ data: dish }, { data: last }] = await Promise.all([
    supabase.from("dishes").select("category").eq("id", parsed.data.dish_id).single(),
    supabase.from("menu_items").select("sort_order").eq("menu_version_id", parsed.data.version_id).order("sort_order", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const { error } = await supabase.from("menu_items").insert({
    menu_version_id: parsed.data.version_id,
    dish_id: parsed.data.dish_id,
    course: parsed.data.course ?? (dish?.category as (typeof COURSES)[number]) ?? "main",
    sort_order: (last?.sort_order ?? 0) + 1,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "That dish is already on this menu." : dbErrorMessage(error) };
  await revalidate(parsed.data.event_id);
  return { ok: true, message: "Dish added." };
}

export async function updateMenuItem(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  const parsed = z
    .object({
      event_id: id,
      item_id: id,
      course: z.enum(COURSES),
      sort_order: z.coerce.number().int().min(0).max(999),
      preparation_notes: text(500),
      cross_contact_notes: text(500),
      cross_contact: z.array(z.enum(ALLERGEN_CODES as [string, ...string[]])),
    })
    .safeParse({ ...Object.fromEntries(formData), cross_contact: formData.getAll("cross_contact").map(String) });
  if (!parsed.success) return validationError(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("menu_items")
    .update({ course: d.course, sort_order: d.sort_order, preparation_notes: d.preparation_notes, cross_contact_notes: d.cross_contact_notes })
    .eq("id", d.item_id);
  if (error) return { ok: false, error: dbErrorMessage(error) };

  let remove = supabase.from("menu_item_cross_contact").delete().eq("menu_item_id", d.item_id);
  if (d.cross_contact.length) remove = remove.not("allergen_code", "in", `(${d.cross_contact.join(",")})`);
  const { error: removeError } = await remove;
  if (removeError) return { ok: false, error: dbErrorMessage(removeError) };
  if (d.cross_contact.length) {
    const { error: insertError } = await supabase
      .from("menu_item_cross_contact")
      .upsert(d.cross_contact.map((code) => ({ menu_item_id: d.item_id, allergen_code: code })), { ignoreDuplicates: true });
    if (insertError) return { ok: false, error: dbErrorMessage(insertError) };
  }
  await revalidate(d.event_id);
  return { ok: true, message: "Dish details saved." };
}

export async function removeMenuItem(eventId: string, itemId: string): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  if (!id.safeParse(eventId).success || !id.safeParse(itemId).success) return { ok: false, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("menu_items").delete().eq("id", itemId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  await revalidate(eventId);
  return { ok: true, message: "Dish removed." };
}

export async function publishMenu(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  const parsed = z
    .object({ event_id: id, version_id: id, change_summary: text(1000), title: text(140), kitchen_notes: text(2000) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  // Publish also saves the title and kitchen note as typed, so a note nobody tapped Save on isn't lost.
  const details = {
    ...(formData.has("title") ? { title: parsed.data.title } : {}),
    ...(formData.has("kitchen_notes") ? { kitchen_notes: parsed.data.kitchen_notes } : {}),
  };
  if (Object.keys(details).length) {
    const { error: detailsError } = await supabase
      .from("menu_versions")
      .update(details)
      .eq("id", parsed.data.version_id)
      .eq("status", "draft");
    if (detailsError) return { ok: false, error: dbErrorMessage(detailsError) };
  }
  const { error } = await supabase.rpc("publish_menu", {
    p_menu_version_id: parsed.data.version_id,
    p_change_summary: parsed.data.change_summary ?? "",
    p_confirm_preparation: formData.get("confirm") === "on",
    p_urgent: formData.get("urgent") === "on",
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  await revalidate(parsed.data.event_id);
  redirect(`/admin/events/${parsed.data.event_id}/menu?notice=${formData.get("urgent") === "on" ? "published_urgent" : "published"}`);
}

export async function postMenuUpdate(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await viewerWithRole(MENU_STAFF);
  if (!viewer) return FORBIDDEN;
  const parsed = z
    .object({
      event_id: id,
      version_id: z.union([z.literal(""), id]).optional().transform((v) => v || null),
      message: z.string().trim().min(3, "Please write a short message.").max(1000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const urgent = formData.get("urgent") === "on";
  const supabase = await createClient();
  const { error } = await supabase.from("menu_updates").insert({
    event_id: parsed.data.event_id,
    menu_version_id: parsed.data.version_id,
    message: parsed.data.message,
    is_urgent: urgent,
    created_by: viewer.id,
  });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  await revalidate(parsed.data.event_id);
  return {
    ok: true,
    message: urgent
      ? "Posted. Everyone who RSVP'd has been notified in the app (no email or text) — contact anyone with a related allergy directly."
      : "Update posted on the event page.",
  };
}

export async function addOption(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  const parsed = z.object({ event_id: id, dish_id: id, note: text(300) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Please choose a dish." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_menu_options").insert(parsed.data);
  if (error) return { ok: false, error: error.code === "23505" ? "That dish is already an option." : dbErrorMessage(error) };
  await revalidate(parsed.data.event_id);
  return { ok: true, message: "Option added." };
}

export async function removeOption(eventId: string, dishId: string): Promise<ActionResult> {
  if (!(await viewerWithRole(MENU_STAFF))) return FORBIDDEN;
  if (!id.safeParse(eventId).success || !id.safeParse(dishId).success) return { ok: false, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("event_menu_options").delete().eq("event_id", eventId).eq("dish_id", dishId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  await revalidate(eventId);
  return { ok: true, message: "Option removed." };
}

export async function setVotingOpen(eventId: string, open: boolean): Promise<ActionResult> {
  if (!(await viewerWithRole(["organizer", "admin"]))) return { ok: false, error: "Only organizers can open or close voting." };
  if (!id.safeParse(eventId).success) return { ok: false, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("events").update({ menu_voting_open: open }).eq("id", eventId);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  await revalidate(eventId);
  return { ok: true, message: open ? "Voting is open." : "Voting is closed." };
}
