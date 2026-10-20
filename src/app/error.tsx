"use client";

import { Button, ButtonLink } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md py-12 text-center" role="alert">
      <h1 className="text-3xl font-extrabold tracking-tight lg:text-[2.5rem] lg:leading-tight">Something went wrong</h1>
      <p className="mt-2 text-muted">Sorry about that. Please try again in a moment.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Go home
        </ButtonLink>
      </div>
    </div>
  );
}
