import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <p className="text-sm font-semibold text-gold-700">Page not found</p>
      <h1 className="mt-1 text-3xl font-extrabold tracking-tight">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-muted">It may have moved, or the event may no longer be available.</p>
      <div className="mt-6 flex justify-center gap-2">
        <ButtonLink href="/">Go home</ButtonLink>
        <ButtonLink href="/events" variant="secondary">
          See events
        </ButtonLink>
      </div>
    </div>
  );
}
