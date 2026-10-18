"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";
import { formatDateTime, siteLocalToUtcIso } from "@/lib/time";

const FORBIDDEN: ActionResult = { ok: false, error: "You don't have permission to do that." };
const when = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? siteLocalToUtcIso(v) : null));

const schema = z
  .object({
    id: z.union([z.literal(""), z.guid()]).optional(),
    title: z.string().trim().min(3, "Please enter a title (3+ characters).").max(140),
    body: z.string().trim().max(4000).optional().transform((v) => v || null),
    audience: z.enum(["public", "members"]),
    status: z.enum(["draft", "published"]),
    is_pinned: z.boolean(),
    is_urgent: z.boolean(),
    publish_at: when,
    expires_at: when,
    event_id: z.union([z.literal(""), z.guid()]).optional().transform((v) => v || null),
  })
  .superRefine((v, ctx) => {
    if (v.expires_at && v.expires_at <= (v.publish_at ?? new Date().toISOString())) {
      ctx.addIssue({ code: "custom", path: ["expires_at"], message: "Must be after the publish time." });
    }
  });

function revalidate() {
  revalidatePath("/admin/announcements");
  revalidatePath("/announcements");
  revalidatePath("/");
}

export async function saveAnnouncement(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(["organizer", "admin"]))) return FORBIDDEN;
  const parsed = schema.safeParse({
    ...Object.fromEntries(formData),
    is_pinned: formData.get("is_pinned") === "on",
    is_urgent: formData.get("is_urgent") === "on",
  });
  if (!parsed.success) return validationError(parsed.error);
  const { id, publish_at, ...values } = parsed.data;
  const row = { ...values, publish_at: publish_at ?? new Date().toISOString() };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("announcements").update(row).eq("id", id)
    : await supabase.from("announcements").insert(row);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidate();
  if (id) return { ok: true, message: "Saved." };
  if (row.status === "draft") return { ok: true, message: "Saved as a draft." };
  if (row.publish_at > new Date().toISOString()) return { ok: true, message: `Scheduled for ${formatDateTime(row.publish_at)}.` };
  return { ok: true, message: "Posted. It's live now." };
}

export async function deleteAnnouncement(id: string): Promise<ActionResult> {
  if (!(await viewerWithRole(["organizer", "admin"]))) return FORBIDDEN;
  if (!z.guid().safeParse(id).success) return { ok: false, error: "Not found." };
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidate();
  return { ok: true, message: "Announcement deleted." };
}
