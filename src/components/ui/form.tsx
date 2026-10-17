"use client";

import { startTransition, useEffect, useRef, type ComponentProps, type FormEvent } from "react";
import type { ActionResult } from "@/lib/action-result";

type Props = Omit<ComponentProps<"form">, "action" | "onSubmit" | "ref"> & {
  /** The dispatcher from useActionState. */
  action: (formData: FormData) => void;
  /** With resetOnSuccess: the form clears after each successful submit (e.g. "Add ingredient"). */
  state?: ActionResult<unknown>;
  resetOnSuccess?: boolean;
};

/**
 * A form for useActionState actions that keeps what people typed when the server returns an error.
 * React resets uncontrolled fields after every <form action> submit, even a failed one. Submitting
 * from onSubmit inside a transition skips that reset. `action` stays on the form so it still works
 * before hydration, and SubmitButton (useFormStatus) still shows progress.
 */
export function Form({ action, state, resetOnSuccess, ...props }: Props) {
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.ok && state.message) ref.current?.reset();
  }, [state, resetOnSuccess]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(formData));
  }

  return <form ref={ref} action={action} onSubmit={onSubmit} {...props} />;
}
