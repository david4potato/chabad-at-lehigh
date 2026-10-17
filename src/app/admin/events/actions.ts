"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";
import { siteLocalToUtcIso, toDateTimeLocalValue } from "@/lib/time";

const ORGANIZERS = ["organizer", "admin"] as const;
const FORBIDDEN: ActionResult = { ok: false, error: "You don't have permission to do that." };

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Please keep this under ${max} characters.`)
    .optional()
    .transform((v) => v || null);

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

const eventSchema = z
  .object({
    title: z.string().trim().min(3, "Please enter a title (3+ characters).").max(140, "Please keep the title under 140 characters."),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .max(80, "Please keep the web address under 80 characters.")
      .regex(/^([a-z0-9]+(-[a-z0-9]+)*)?$/, "Use lowercase letters, numbers and single dashes only.")
      .optional(),
    summary: text(280),
    description: text(5000),
    category: z.enum(["shabbat_dinner", "holiday", "learning", "social", "volunteer", "other"]),
    status: z.enum(["draft", "published", "cancelled"]),
    visibility: z.enum(["public", "members"]),
    starts_at: localDateTime.refine((v) => v !== null, "Please enter a start date and time."),
    ends_at: localDateTime,
    location_name: text(140),
    location_address: text(280),
    capacity: z
      .union([z.literal(""), z.coerce.number().int("Whole numbers only.").min(1, "At least 1.").max(5000, "Up to 5,000.")])
      .optional()
      .transform((v) => (v === "" || v === undefined ? null : v)),
    rsvp_enabled: z.boolean(),
    rsvp_deadline: localDateTime,
    approval_mode: z.enum(["auto", "guests_need_approval", "all_need_approval"]),
    max_guests_per_rsvp: z.coerce.number().int().min(0, "0 to 10.").max(10, "0 to 10."),
    has_meal: z.boolean(),
    menu_voting_open: z.boolean(),
    contact_name: text(120),
    contact_email: z
      .union([z.literal(""), z.email("Please enter a valid email.").max(254)])
      .optional()
      .transform((v) => v || null),
    contact_phone: text(40),
  })
  .superRefine((v, ctx) => {
    if (v.ends_at && v.starts_at && v.ends_at < v.starts_at) {
      ctx.addIssue({ code: "custom", path: ["ends_at"], message: "The end must be after the start." });
    }
  });

function slugify(title: string, startsAtIso: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return `${base || "event"}-${toDateTimeLocalValue(startsAtIso).slice(0, 10)}`;
}

function parseEventForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  return eventSchema.safeParse({
    ...raw,
    rsvp_enabled: formData.get("rsvp_enabled") === "on",
    has_meal: formData.get("has_meal") === "on",
    menu_voting_open: formData.get("menu_voting_open") === "on",
  });
}

function revalidateEvents(slug?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath("/events");
  if (slug) revalidatePath(`/events/${slug}`);
}

export async function createEvent(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return FORBIDDEN;
  const parsed = parseEventForm(formData);
  if (!parsed.success) return validationError(parsed.error);
  const { slug, ...values } = parsed.data;

  const supabase = await createClient();
  const base = slug || slugify(values.title, values.starts_at!);
  const insert = (s: string) => supabase.from("events").insert({ ...values, starts_at: values.starts_at!, slug: s }).select("id").single();
  let result = await insert(base);
  // Same title on the same day: the address was made for them, so find a free one.
  if (result.error?.code === "23505" && !slug) result = await insert(`${base}-${Math.random().toString(36).slice(2, 6)}`);
  const { data, error } = result;
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That web address is already used. Please change it.", fieldErrors: { slug: ["Already in use."] } };
    return { ok: false, error: dbErrorMessage(error) };
  }
  revalidateEvents();
  redirect(`/admin/events/${data.id}?saved=1`);
}

export async function updateEvent(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return FORBIDDEN;
  const id = String(formData.get("id") ?? "");
  if (!z.guid().safeParse(id).success) return { ok: false, error: "We couldn't find that event." };
  const parsed = parseEventForm(formData);
  if (!parsed.success) return validationError(parsed.error);
  const { slug, ...values } = parsed.data;

  const supabase = await createClient();
  // A blank web address keeps the current one: shared links and notifications point to it.
  const { data, error } = await supabase
    .from("events")
    .update({ ...values, starts_at: values.starts_at!, ...(slug ? { slug } : {}) })
    .eq("id", id)
    .select("slug")
    .single();
  if (error) {
    if (error.code === "23505") return { ok: false, error: "That web address is already used. Please change it.", fieldErrors: { slug: ["Already in use."] } };
    return { ok: false, error: dbErrorMessage(error) };
  }
  revalidateEvents(data.slug);
  return { ok: true, message: "Event saved." };
}

/** Copy an event one week later as a draft (great for weekly Shabbat dinners). */
export async function duplicateEvent(id: string): Promise<ActionResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return FORBIDDEN;
  if (!z.guid().safeParse(id).success) return { ok: false, error: "We couldn't find that event." };
  const supabase = await createClient();
  const { data: e, error } = await supabase.from("events").select("*").eq("id", id).single();
  if (error || !e) return { ok: false, error: dbErrorMessage(error) };

  const week = 7 * 24 * 60 * 60 * 1000;
  const shift = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + week).toISOString() : null);
  const startsAt = shift(e.starts_at)!;
  // Keep wall-clock time steady across daylight-saving changes.
  const local = toDateTimeLocalValue(e.starts_at).slice(11);
  const fixedStart = siteLocalToUtcIso(`${toDateTimeLocalValue(startsAt).slice(0, 10)}T${local}`) ?? startsAt;
  const delta = new Date(fixedStart).getTime() - new Date(e.starts_at).getTime();
  const move = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + delta).toISOString() : null);

  const baseTitle = e.title.replace(/^\[DEMO\]\s*/, "");
  let slug = slugify(baseTitle, fixedStart);
  const { data: clash } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: copy, error: insertError } = await supabase
    .from("events")
    .insert({
      slug,
      title: e.title,
      summary: e.summary,
      description: e.description,
      category: e.category,
      status: "draft",
      visibility: e.visibility,
      starts_at: fixedStart,
      ends_at: move(e.ends_at),
      location_name: e.location_name,
      location_address: e.location_address,
      capacity: e.capacity,
      rsvp_enabled: e.rsvp_enabled,
      rsvp_deadline: move(e.rsvp_deadline),
      approval_mode: e.approval_mode,
      max_guests_per_rsvp: e.max_guests_per_rsvp,
      has_meal: e.has_meal,
      menu_voting_open: false,
      contact_name: e.contact_name,
      contact_email: e.contact_email,
      contact_phone: e.contact_phone,
      is_demo: e.is_demo,
    })
    .select("id")
    .single();
  if (insertError) return { ok: false, error: dbErrorMessage(insertError) };
  revalidateEvents();
  redirect(`/admin/events/${copy.id}?duplicated=1`);
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  if (!(await viewerWithRole(["admin"]))) return { ok: false, error: "Only admins can delete events. Try cancelling it instead." };
  if (!z.guid().safeParse(id).success) return { ok: false, error: "We couldn't find that event." };
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidateEvents();
  redirect("/admin/events?deleted=1");
}
