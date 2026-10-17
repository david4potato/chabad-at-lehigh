"use server";

import { revalidatePath } from "next/cache";
import { viewerWithRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dbErrorMessage, type ActionResult } from "@/lib/action-result";

/** Deletes everything marked [DEMO] (admins only; the SQL function checks too). */
export async function removeDemoData(): Promise<ActionResult> {
  if (!(await viewerWithRole(["admin"]))) return { ok: false, error: "Only admins can do that." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_remove_demo_data");
  if (error) return { ok: false, error: dbErrorMessage(error) };
  revalidatePath("/", "layout");
  return { ok: true, message: "Demo content removed." };
}
