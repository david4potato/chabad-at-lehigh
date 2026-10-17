"use server";

import { cookies } from "next/headers";
import { getViewer } from "@/lib/auth";
import { NEXT_COOKIE, safeNextPath } from "@/lib/safe-redirect";

/** After a successful sign-in: where should this person go next? */
export async function postSignInDestination(next: string | null): Promise<string> {
  const cookieStore = await cookies();
  const target = safeNextPath(next ?? cookieStore.get(NEXT_COOKIE)?.value ?? null, "/");
  cookieStore.delete(NEXT_COOKIE);
  const viewer = await getViewer();
  if (viewer && !viewer.onboarded) return `/welcome?next=${encodeURIComponent(target)}`;
  return target;
}
