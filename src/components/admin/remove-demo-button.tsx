"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { removeDemoData } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export function RemoveDemoButton() {
  const [confirming, setConfirming] = useState(false);
  const [busy, startBusy] = useTransition();
  const [state, setState] = useState<ActionResult | null>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const questionId = useId();

  // Move keyboard focus into the confirmation so it's announced and reachable.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus();
  }, [confirming]);

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        Remove demo content
      </Button>
    );
  }
  return (
    <div
      role="group"
      aria-labelledby={questionId}
      className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900"
    >
      <span id={questionId} className="basis-full">
        Delete every [DEMO] event, menu, dish and announcement? Real content stays.
      </span>
      {/* On success the action redirects to /admin with a confirmation message. */}
      <Button variant="danger" disabled={busy} onClick={() => startBusy(async () => setState(await removeDemoData()))}>
        Yes, remove
      </Button>
      <Button ref={cancelRef} variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </div>
  );
}
