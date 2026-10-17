"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";

const field = (max: number) => z.string().trim().max(max, `Please keep this under ${max} characters.`).default("");

const schema = z.object({
  name: z.string().trim().min(2, "Please enter a name.").max(120, "Please keep this under 120 characters."),
  contact_name: field(120),
  contact_email: z.union([z.literal(""), z.email("Please enter a valid email.").max(254)]).default(""),
  contact_phone: field(40),
  address: field(280),
  directions: field(2000),
  parking: field(1000),
  map_query: field(280),
  student_email_domains: z
    .string()
    .trim()
    .max(500, "Please keep this under 500 characters.")
    .transform((v) =>
      v
        .split(/[\s,;]+/)
        .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean),
    )
    // Checked as one list so the error shows under the field (not at "student_email_domains.1").
    .superRefine((list, ctx) => {
      const bad = list.filter((d) => !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d));
      if (bad.length) ctx.addIssue({ code: "custom", message: `${bad.join(", ")} isn't a domain. Use domains like lehigh.edu.` });
      if (list.length > 10) ctx.addIssue({ code: "custom", message: "Up to 10 domains." });
    }),
});

export async function saveSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const viewer = await viewerWithRole(["admin"]);
  if (!viewer) return { ok: false, error: "Only admins can change settings." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { student_email_domains, ...organization } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert([
    // updated_by ticks the "Check the contact details" step in Getting started.
    { key: "organization", value: organization, updated_by: viewer.id },
    { key: "student_email_domains", value: student_email_domains, updated_by: viewer.id },
  ]);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}
