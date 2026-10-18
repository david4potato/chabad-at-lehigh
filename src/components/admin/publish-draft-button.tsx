"use client";

import { Button } from "@/components/ui/button";
import { EVENT_FORM_ID } from "@/components/admin/event-form";

/**
 * "Publish" for a draft: sets the event form's Status to Published and submits it, so any edits are
 * saved too and the server's checks still run. Feedback shows in the form's save bar.
 */
export function PublishDraftButton() {
  function publish() {
    const form = document.getElementById(EVENT_FORM_ID);
    if (!(form instanceof HTMLFormElement)) return;
    const status = form.elements.namedItem("status");
    if (status instanceof HTMLSelectElement) status.value = "published";
    form.requestSubmit();
  }
  return <Button onClick={publish}>Publish</Button>;
}
