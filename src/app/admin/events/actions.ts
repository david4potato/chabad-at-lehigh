"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";
import { formatShortDateMaybeYear, siteLocalToUtcIso, toDateTimeLocalValue } from "@/lib/time";
import { repeatStarts } from "@/lib/recurrence";
import type { Database } from "@/lib/database.types";

const ORGANIZERS = ["organizer", "admin"] as const;
const FORBIDDEN: ActionResult = { ok: false, error: "You don't have permission to do that." };

/** Event form result. `next` is the following step, shown as a link (e.g. the Menu tab after publishing). */
export type EventResult = ActionResult<{ next?: { href: string; label: string } }>;

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
  });
}

function revalidateEvents(slug?: string) {
  revalidatePath("/admin", "layout");
  revalidatePath("/");
  revalidatePath("/events");
  if (slug) revalidatePath(`/events/${slug}`);
}

export async function createEvent(_prev: EventResult, formData: FormData): Promise<EventResult> {
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

export async function updateEvent(_prev: EventResult, formData: FormData): Promise<EventResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return FORBIDDEN;
  const id = String(formData.get("id") ?? "");
  if (!z.guid().safeParse(id).success) return { ok: false, error: "We couldn't find that event." };
  const parsed = parseEventForm(formData);
  if (!parsed.success) return validationError(parsed.error);
  const { slug, ...values } = parsed.data;

  const supabase = await createClient();
  const { data: before } = await supabase.from("events").select("status").eq("id", id).maybeSingle();
  if (!before) return { ok: false, error: "We couldn't find that event." };

  // Back to Draft would hide the event from people who are coming, without telling them.
  if (before.status === "published" && values.status === "draft") {
    const { count, error: countError } = await supabase
      .from("rsvps")
      .select("id", { count: "exact", head: true })
      .eq("event_id", id)
      .in("status", ["going", "waitlist", "pending"]);
    if (countError) return { ok: false, error: dbErrorMessage(countError) };
    if (count) {
      return {
        ok: false,
        error: "People have RSVP'd, so it can't go back to Draft. Choose Cancelled instead, and they'll be told.",
        fieldErrors: { status: ["People have RSVP'd. Choose Cancelled instead."] },
      };
    }
  }

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

  if (before.status === "draft" && values.status === "published") {
    // Point to the next step of the weekly routine: the menu, unless one is already live.
    if (values.has_meal) {
      const { data: menus } = await supabase.from("menu_versions").select("status").eq("event_id", id);
      if (!menus?.some((m) => m.status === "published")) {
        const label = menus?.length ? "Next: check the menu and publish it" : "Next: add the menu";
        return { ok: true, message: "Published.", data: { next: { href: `/admin/events/${id}/menu`, label } } };
      }
    }
    return { ok: true, message: "Published." };
  }
  return { ok: true, message: "Event saved." };
}

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Copies an event to a new start time with the same details, its menu as a draft (so staff still
 * confirm preparation) and its volunteer shifts. Everything else moves by the same amount.
 */
async function copyEvent(supabase: Supabase, e: EventRow, startsAt: string, slug: string, status: "draft" | "published") {
  const delta = new Date(startsAt).getTime() - new Date(e.starts_at).getTime();
  const move = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() + delta).toISOString() : null);

  const { data: copy, error } = await supabase
    .from("events")
    .insert({
      slug,
      title: e.title,
      summary: e.summary,
      description: e.description,
      category: e.category,
      status,
      visibility: e.visibility,
      starts_at: startsAt,
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
  if (error) return { ok: false as const, error: dbErrorMessage(error) };

  // The menu and the shifts can fail without undoing the copy: the event is what matters, and
  // both can be added by hand.
  const { data: shifts } = await supabase
    .from("volunteer_shifts")
    .select("title, description, slots, starts_at, ends_at, status, is_demo")
    .eq("event_id", e.id);
  await Promise.all([
    e.has_meal ? supabase.rpc("copy_menu_to_event", { p_source_event: e.id, p_target_event: copy.id }) : null,
    shifts?.length
      ? supabase.from("volunteer_shifts").insert(
          shifts.map((s) => ({
            event_id: copy.id,
            title: s.title,
            description: s.description,
            slots: s.slots,
            starts_at: move(s.starts_at)!,
            ends_at: move(s.ends_at),
            // New sign-ups start fresh; a shift kept as a draft stays a draft.
            status: s.status === "draft" ? ("draft" as const) : ("open" as const),
            is_demo: s.is_demo,
          })),
        )
      : null,
  ]);
  return { ok: true as const, id: copy.id };
}

/**
 * Copy an event to the same time next week as a draft (great for weekly Shabbat dinners), with its
 * menu as a draft and its volunteer shifts. An older event is copied to the first such week from now.
 */
export async function duplicateEvent(id: string): Promise<ActionResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return FORBIDDEN;
  if (!z.guid().safeParse(id).success) return { ok: false, error: "We couldn't find that event." };
  const supabase = await createClient();
  const { data: e, error } = await supabase.from("events").select("*").eq("id", id).single();
  if (error || !e) return { ok: false, error: dbErrorMessage(error) };

  const [startsAt] = repeatStarts(e.starts_at, 1, 1);
  let slug = slugify(e.title.replace(/^\[DEMO\]\s*/, ""), startsAt);
  const { data: clash } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

  const copy = await copyEvent(supabase, e, startsAt, slug, "draft");
  if (!copy.ok) return copy;
  revalidateEvents();
  redirect(`/admin/events/${copy.id}?duplicated=1`);
}

const repeatSchema = z.object({
  event_id: z.guid(),
  every: z.coerce.number().int().min(1).max(4),
  count: z.coerce
    .number({ message: "Please enter a number." })
    .int("Whole numbers only.")
    .min(1, "At least 1.")
    .max(26, "Up to 26 at a time."),
  status: z.enum(["draft", "published"]),
});

/**
 * Repeat an event every 1-4 weeks: each date becomes its own event, copied like "Duplicate for next
 * week". A date that already has this event (same title, same day) is skipped, so nothing doubles up.
 */
export async function repeatEvent(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(ORGANIZERS))) return FORBIDDEN;
  const parsed = repeatSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { event_id, every, count, status } = parsed.data;
  const supabase = await createClient();
  const { data: e, error } = await supabase.from("events").select("*").eq("id", event_id).single();
  if (error || !e) return { ok: false, error: "We couldn't find that event." };
  if (e.status === "cancelled") return { ok: false, error: "This event is cancelled. Repeat one that's going ahead." };

  const starts = repeatStarts(e.starts_at, every, count);
  const baseTitle = e.title.replace(/^\[DEMO\]\s*/, "");
  const slugs = starts.map((s) => slugify(baseTitle, s));
  const { data: existing } = await supabase.from("events").select("slug").in("slug", slugs);
  const taken = new Set((existing ?? []).map((r) => r.slug));
  const todo = starts.map((s, i) => ({ start: s, slug: slugs[i] })).filter((o) => !taken.has(o.slug));

  const results = await Promise.all(todo.map((o) => copyEvent(supabase, e, o.start, o.slug, status)));
  const added = todo.filter((_, i) => results[i].ok).map((o) => o.start);
  const failed = results.find((r) => !r.ok);
  revalidateEvents();
  if (added.length === 0) {
    if (failed && !failed.ok) return { ok: false, error: failed.error };
    return { ok: false, error: "Every one of those dates already has this event, so nothing was added." };
  }

  const n = added.length;
  const range = n === 1 ? formatShortDateMaybeYear(added[0]) : `${formatShortDateMaybeYear(added[0])} to ${formatShortDateMaybeYear(added[n - 1])}`;
  const parts = [
    `Added ${n} ${n === 1 ? "event" : "events"}: ${range}.`,
    status === "draft" ? "They're drafts: publish each one from Events → Drafts when it's ready." : "They're published.",
  ];
  if (e.has_meal) parts.push("Each menu is a draft until the kitchen publishes it.");
  const skipped = starts.length - todo.length;
  if (skipped) parts.push(`Skipped ${skipped} ${skipped === 1 ? "date that already has" : "dates that already have"} this event.`);
  if (failed && !failed.ok) parts.push(`${todo.length - n} couldn't be added: ${failed.error}`);
  return { ok: true, message: parts.join(" ") };
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
