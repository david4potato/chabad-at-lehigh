"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Lock } from "lucide-react";
import { saveMealPreference } from "@/app/events/actions";
import { initialActionState } from "@/lib/action-result";
import { Alert } from "@/components/ui/alert";
import { Field, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

type Props = {
  eventId: string;
  slug: string;
  initial: { preference: string | null; guest_dietary_notes: string | null } | null;
  allowsGuests: boolean;
  /** The person's dietary profile setting. When off, the kitchen doesn't see their meal note. */
  shareWithKitchen: boolean;
};

export function MealPreferenceForm({ eventId, slug, initial, allowsGuests, shareWithKitchen }: Props) {
  const [state, action] = useActionState(saveMealPreference, initialActionState);
  const errors = state.ok ? undefined : state.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="slug" value={slug} />
      <p className="flex items-start gap-2 text-sm text-muted">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Private: only you and our kitchen staff/admins can see this. Allergies belong in your{" "}
        <Link href="/profile/dietary" className="font-semibold text-brand-700 hover:underline">
          dietary profile
        </Link>
        .
      </p>
      {!shareWithKitchen ? (
        <Alert tone="warning" role="note" title="Sharing with the kitchen is off">
          Kitchen staff won&apos;t see your meal note.{" "}
          {allowsGuests ? "Your guests' dietary needs are still shared with them. " : null}
          Turn sharing on in your{" "}
          <Link href="/profile/dietary" className="font-semibold underline underline-offset-2">
            dietary profile
          </Link>
          , or contact the organizer directly.
        </Alert>
      ) : null}
      <Field label="Anything the kitchen should know for this meal?" htmlFor="meal-preference" errors={errors?.preference}>
        <Textarea
          id="meal-preference"
          name="preference"
          rows={2}
          maxLength={500}
          defaultValue={initial?.preference ?? ""}
          placeholder="e.g. vegetarian main please"
        />
      </Field>
      {allowsGuests ? (
        <Field label="Your guests' dietary needs" htmlFor="guest-dietary" errors={errors?.guest_dietary_notes}>
          <Textarea
            id="guest-dietary"
            name="guest_dietary_notes"
            rows={2}
            maxLength={500}
            defaultValue={initial?.guest_dietary_notes ?? ""}
            placeholder="e.g. my guest is allergic to tree nuts"
          />
        </Field>
      ) : null}
      <SubmitButton variant="secondary">Save meal notes</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
