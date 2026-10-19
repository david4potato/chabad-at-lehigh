"use client";

import { useActionState } from "react";
import { invitePeople, type InviteResult } from "@/app/admin/events/[id]/attendees/actions";
import { SITE } from "@/config/site";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";
import { Form } from "@/components/ui/form";

const LABELS: Record<string, string> = {
  invited: "Invited — they'll see it in their notifications",
  already_rsvped: "Already RSVP'd",
  already_invited: "Already invited (not yet seen)",
  no_account: "No account yet — send them the link",
  invalid: "Not a valid email address",
};

export function InvitePeople({ eventId, published }: { eventId: string; published: boolean }) {
  const [state, action] = useActionState(invitePeople, { ok: true } as InviteResult);
  const results = state.ok ? (state.data ?? []) : [];
  const noAccount = results.filter((r) => r.result === "no_account").map((r) => r.email);

  if (!published) {
    return <p className="text-sm text-muted">Publish the event first, then you can invite people.</p>;
  }

  return (
    <div className="space-y-4">
      <Form action={action} state={state} resetOnSuccess className="space-y-4">
        <input type="hidden" name="event_id" value={eventId} />
        <Field
          label="Email addresses"
          htmlFor="invite-emails"
          hint="Separate with commas or new lines, or paste from an email's To line. We don't send emails. People with an account get an in-app invitation. We'll list the others so you can send them the link."
        >
          <Textarea id="invite-emails" name="emails" rows={3} required placeholder={`sarah@${SITE.campus.studentEmailDomains[0]}, josh@gmail.com`} />
        </Field>
        <Field label="Personal message (optional)" htmlFor="invite-message">
          <Input id="invite-message" name="message" maxLength={500} placeholder="Hope you can make it!" />
        </Field>
        <SubmitButton pendingText="Sending…">Send invitations</SubmitButton>
        <FormMessage state={state} />
      </Form>
      {results.length ? (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 text-sm">
          {results.map((r) => (
            <li key={r.email} className="flex flex-col gap-0.5 px-3 py-2 sm:flex-row sm:justify-between">
              <span className="break-all font-medium text-ink">{r.email}</span>
              <span className={r.result === "invited" ? "text-green-800" : "text-muted"}>{LABELS[r.result] ?? r.result}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {noAccount.length ? (
        <p className="text-sm text-muted">
          Tip: use <strong>Copy event link</strong> at the top of this page and email it to the {noAccount.length === 1 ? "person" : "people"} without an
          account. They can sign up in seconds when they RSVP.
        </p>
      ) : null}
    </div>
  );
}
