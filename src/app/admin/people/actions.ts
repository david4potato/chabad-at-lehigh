"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, validationError, type ActionResult } from "@/lib/action-result";
import { ROLES } from "@/lib/roles";

const FORBIDDEN: ActionResult = { ok: false, error: "Only admins can change roles." };
const role = z.enum(ROLES);

export async function grantRole(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await viewerWithRole(["admin"]))) return FORBIDDEN;
  const parsed = z
    .object({ email: z.email("Please enter a valid email.").trim().toLowerCase().max(254), role })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return validationError(parsed.error);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_grant_role", { p_email: parsed.data.email, p_role: parsed.data.role });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/people");
  return {
    ok: true,
    message:
      data === "pending"
        ? `${parsed.data.email} hasn't signed in yet. They'll get the role the first time they do.`
        : "Role granted. They'll see it next time they load a page.",
  };
}

export async function revokeRole(userId: string, r: string): Promise<ActionResult> {
  if (!(await viewerWithRole(["admin"]))) return FORBIDDEN;
  const parsed = z.object({ userId: z.guid(), role }).safeParse({ userId, role: r });
  if (!parsed.success) return { ok: false, error: "Something didn't look right." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_revoke_role", { p_user_id: parsed.data.userId, p_role: parsed.data.role });
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/people");
  return { ok: true, message: "Role removed." };
}

export async function removePendingGrant(email: string, r: string): Promise<ActionResult> {
  if (!(await viewerWithRole(["admin"]))) return FORBIDDEN;
  const parsed = z.object({ email: z.email(), role }).safeParse({ email, role: r });
  if (!parsed.success) return { ok: false, error: "Something didn't look right." };
  const supabase = await createClient();
  const { error } = await supabase.from("pending_role_grants").delete().eq("email", parsed.data.email).eq("role", parsed.data.role);
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/admin/people");
  return { ok: true, message: "Pending role removed." };
}
