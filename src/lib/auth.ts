import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ROLES, type Role } from "@/lib/roles";

export type Viewer = {
  id: string;
  email: string;
  fullName: string | null;
  preferredName: string | null;
  displayName: string;
  affiliation: string;
  onboarded: boolean;
  roles: Role[];
  unreadNotifications: number;
  hasDietaryInfo: boolean;
};

type MyContext = {
  user_id: string;
  email: string;
  full_name: string | null;
  preferred_name: string | null;
  affiliation: string;
  onboarded: boolean;
  roles: string[];
  unread_notifications: number;
  has_dietary_info: boolean;
};

/**
 * The signed-in person (or null). Cached per request, so calling it from the
 * layout and the page costs one auth check + one database round trip total.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  if (!claimsData?.claims?.sub) return null;

  const { data, error } = await supabase.rpc("get_my_context");
  if (error || !data) return null;
  const ctx = data as unknown as MyContext;

  const roles = (ctx.roles ?? []).filter((r): r is Role => (ROLES as readonly string[]).includes(r));
  const displayName =
    ctx.preferred_name?.trim() || ctx.full_name?.trim().split(/\s+/)[0] || ctx.email.split("@")[0];

  return {
    id: ctx.user_id,
    email: ctx.email,
    fullName: ctx.full_name,
    preferredName: ctx.preferred_name,
    displayName,
    affiliation: ctx.affiliation,
    onboarded: ctx.onboarded,
    roles,
    unreadNotifications: Number(ctx.unread_notifications ?? 0),
    hasDietaryInfo: Boolean(ctx.has_dietary_info),
  };
});

/** Require a signed-in person; otherwise send them to sign in and come back. */
export async function requireViewer(nextPath: string): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  return viewer;
}

/**
 * Require one of the given roles. Use in every staff page AND every staff
 * server action (layouts alone do not protect server actions).
 */
export async function requireRole(allowed: readonly Role[], nextPath = "/admin"): Promise<Viewer> {
  const viewer = await requireViewer(nextPath);
  if (!viewer.roles.some((r) => allowed.includes(r))) redirect("/?denied=1");
  return viewer;
}

/** For server actions: the viewer if they hold one of the roles, else null. */
export async function viewerWithRole(allowed: readonly Role[]): Promise<Viewer | null> {
  const viewer = await getViewer();
  if (!viewer || !viewer.roles.some((r) => allowed.includes(r))) return null;
  return viewer;
}
