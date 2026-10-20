"use client";

import { useFormStatus } from "react-dom";
import type { ComponentProps } from "react";
import { Button } from "./button";

type Props = ComponentProps<typeof Button> & { pendingText?: string };

/**
 * A submit button that shows progress and ignores clicks while the form submits. It uses aria-disabled, not the
 * disabled attribute, so keyboard focus stays on it instead of jumping to the top of the page.
 */
export function SubmitButton({ children, pendingText, disabled, onClick, ...props }: Props) {
  const { pending } = useFormStatus();
  const off = pending || disabled;
  return (
    <Button
      type="submit"
      aria-disabled={off || undefined}
      onClick={(e) => {
        if (off) e.preventDefault();
        else onClick?.(e);
      }}
      {...props}
    >
      {pending ? (
        <>
          <span
            className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent"
            aria-hidden="true"
          />
          {pendingText ?? "Saving…"}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
