"use client";

import { useState, useTransition } from "react";
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

  if (!open) {
    return (
      <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }
  return (
    <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p>
        This permanently deletes your account, RSVPs, dietary information, votes, suggestions and notifications. If you
        held a seat at an upcoming event, it goes to the next person on the waitlist. This can&apos;t be undone.
      </p>
      <Field label='Type "DELETE" to confirm' htmlFor="confirm-delete">
        <Input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Field>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          disabled={pending || typed.trim().toUpperCase() !== "DELETE"}
          onClick={() => start(async () => setResult(await deleteAccount()))}
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
