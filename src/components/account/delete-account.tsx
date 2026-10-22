"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { deleteAccount } from "@/app/profile/actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";

/** Two-step account deletion: explain, then type DELETE to confirm. */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const openerRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const wasOpen = useRef(false);
  // Opening moves focus into the confirm box; closing brings it back to the button.
  useEffect(() => {
    if (open) confirmRef.current?.focus();
    else if (wasOpen.current) openerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);
  const ready = typed.trim().toUpperCase() === "DELETE";

  if (!open) {
    return (
      <Button ref={openerRef} variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="text-base">
        This permanently deletes your account, RSVPs, dietary information, votes, suggestions and notifications. Any
        seat you hold at an upcoming event goes to the next person on the waitlist.
      </p>
      <Field label='Type "DELETE" to confirm' htmlFor="confirm-delete">
        <Input ref={confirmRef} id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          aria-disabled={pending || !ready || undefined}
          onClick={() => {
            if (!pending && ready) start(async () => setResult(await deleteAccount()));
          }}
        >
          {pending ? "Deleting…" : "Delete my account"}
        </Button>
        <Button variant="secondary" onClick={() => setOpen(false)}>
          Keep my account
        </Button>
      </div>
      <FormMessage state={result} />
    </div>
  );
}
