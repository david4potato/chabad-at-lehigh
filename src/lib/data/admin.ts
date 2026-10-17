import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type AdminEvent = Database["public"]["Tables"]["events"]["Row"];

/** Full event row for staff pages (RLS lets staff read drafts). 404 when missing. */
export const getAdminEvent = cache(async (id: string): Promise<AdminEvent> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data;
});
