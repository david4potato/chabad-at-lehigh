import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { SITE } from "@/config/site";

export type OrgSettings = {
  name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  directions: string;
  parking: string;
  map_query: string;
};

const DEFAULTS: OrgSettings = {
  name: SITE.name,
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  address: "",
  directions: "",
  parking: "",
  map_query: "",
};

/** Organization contact info and address (Admin → Settings). Cached per request. */
export const getOrgSettings = cache(async (): Promise<OrgSettings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", "organization").maybeSingle();
  const value = (data?.value ?? {}) as Partial<OrgSettings>;
  const clean = Object.fromEntries(
    Object.entries(value).map(([k, v]) => [k, typeof v === "string" ? v : ""]),
  ) as Partial<OrgSettings>;
  return { ...DEFAULTS, ...clean };
});
