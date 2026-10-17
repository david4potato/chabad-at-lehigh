"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { Check, HandHeart } from "lucide-react";
import { cancelSignup, signUp } from "@/app/volunteer/actions";
import type { ActionResult } from "@/lib/action-result";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

type Props = {
  shiftId: string;
  /** id of the shift's title, so screen readers hear which "Sign up" this is. */
  titleId: string;
  mine: boolean;
  full: boolean;
  /** The shift has started: people can no longer sign up or drop out. */
  started: boolean;
  /** No new sign-ups: the shift has started or organizers closed it. */
  closed: boolean;
  signedIn: boolean;
  /** Where signed-out visitors come back to after signing in. */
  nextPath: string;
};

const Spinner = () => (
  <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
);

/**
 * One-tap "Sign up" / "Can't make it" for a volunteer shift. The page refreshes after each change.
 * "Can't make it" stays available until the shift starts, even when organizers closed sign-ups.
 */
export function SignupControls({ shiftId, titleId, mine, full, started, closed, signedIn, nextPath }: Props) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  // `mine` when this person pressed a button here, so focus only moves after their own action.
  const mineAtPress = useRef<boolean | null>(null);

  // The pressed button is swapped for a different control after the refresh. Once that has
  // happened (and the new button is enabled), move focus to it, or to the wrapper, so keyboard
  // and screen-reader users keep their place.
  useEffect(() => {
    if (pending || mineAtPress.current === null || mineAtPress.current === mine) return;
    mineAtPress.current = null;
    const wrap = wrapRef.current;
    if (!wrap) return;
    (wrap.querySelector<HTMLElement>("button, a") ?? wrap).focus();
  }, [mine, pending]);

  const run = (fn: (id: string) => Promise<ActionResult>) => {
    mineAtPress.current = mine;
    start(async () => {
      setResult(null);
      const res = await fn(shiftId);
      if (!res.ok) mineAtPress.current = null;
      setResult(res);
    });
  };

  let control: ReactNode;
  if (signedIn && mine) {
    control = (
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="green" className="py-1 text-sm">
          <Check className="size-4" aria-hidden="true" /> You&apos;re signed up
        </Badge>
        {!started ? (
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            disabled={pending}
            aria-describedby={titleId}
            onClick={() => run(cancelSignup)}
          >
            {pending ? <Spinner /> : null}
            {pending ? "Saving…" : "Can't make it"}
          </Button>
        ) : null}
      </div>
    );
  } else if (closed) {
    control = <Badge className="py-1 text-sm">Sign-ups closed</Badge>;
  } else if (full) {
    control = (
      <Badge tone="amber" className="py-1 text-sm">
        Full
      </Badge>
    );
  } else if (!signedIn) {
    control = (
      <ButtonLink
        href={`/sign-in?next=${encodeURIComponent(nextPath)}`}
        variant="secondary"
        className="w-full sm:w-auto"
        aria-describedby={titleId}
        prefetch={false}
      >
        Sign in to help
      </ButtonLink>
    );
  } else {
    control = (
      <Button className="w-full sm:w-auto" disabled={pending} aria-describedby={titleId} onClick={() => run(signUp)}>
        {pending ? <Spinner /> : <HandHeart className="size-4" aria-hidden="true" />}
        {pending ? "Saving…" : "Sign up"}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={wrapRef} tabIndex={-1}>
        {control}
      </div>
      <FormMessage state={result} />
    </div>
  );
}
