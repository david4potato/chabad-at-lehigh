"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";

const field = (max: number) => z.string().trim().max(max, `Please keep this under ${max} characters.`).default("");

const schema = z.object({
  name: z.string().trim().min(2, "Please enter a name.").max(120),
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
    .max(500)
    .transform((v) =>
      v
        .split(/[\s,]+/)
        .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(/^[a-z0-9-]+(\.[a-z0-9-]+)+$/, "Use domains like lehigh.edu")).max(10)),
});

export async function saveSettings(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(["admin"]))) return { ok: false, error: "Only admins can change settings." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const { student_email_domains, ...organization } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").upsert([
    { key: "organization", value: organization },
    { key: "student_email_domains", value: student_email_domains },
  ]);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Settings saved." };
}
