import type { Metadata } from "next";
import { getViewer } from "@/lib/auth";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Page not found" };

export default async function NotFound() {
  // Members-only events look missing to signed-out visitors, so offer sign-in.
  const viewer = await getViewer();
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <p className="text-sm font-semibold text-gold-700">Page not found</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">
        It may have moved, or the event may no longer be available.
        {viewer ? null : " Some events are only for signed-in members, so try signing in."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {viewer ? <ButtonLink href="/">Go home</ButtonLink> : <ButtonLink href="/sign-in">Sign in</ButtonLink>}
        <ButtonLink href="/events" variant="secondary">
          See events
        </ButtonLink>
      </div>
    </div>
  );
}
