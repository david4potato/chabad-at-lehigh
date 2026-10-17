"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";
import { removeDemoData } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export function RemoveDemoButton() {
  const [confirming, setConfirming] = useState(false);
  const [busy, startBusy] = useTransition();
  const [state, setState] = useState<ActionResult | null>(null);

  if (!confirming) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
        Remove demo content
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <span className="flex-1">Delete every [DEMO] event, menu, dish and announcement? Real content stays.</span>
      <Button size="sm" variant="danger" disabled={busy} onClick={() => startBusy(async () => setState(await removeDemoData()))}>
        Yes, remove
      </Button>
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      <div className="w-full">
        <FormMessage state={state} />
      </div>
    </div>
  );
}
