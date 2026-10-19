"use client";

import { useActionState } from "react";
import { ChevronDown, Repeat } from "lucide-react";
import { repeatEvent } from "@/app/admin/events/actions";
import { initialActionState } from "@/lib/action-result";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Form } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/form-message";

/** Repeat an event on more dates (weekly dinners, a cooking group, a class), each its own event. */
export function RepeatEventForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(repeatEvent, initialActionState);
  const e = state.ok ? undefined : state.fieldErrors;
  return (
    <details className="group mt-3 rounded-[var(--radius-card)] border border-stone-200 bg-white px-4 shadow-sm">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
        <Repeat className="size-4 text-gold-700" aria-hidden="true" />
        Repeat this event on more dates
        <ChevronDown className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <Form action={action} className="space-y-4 pb-4 pt-1">
        <input type="hidden" name="event_id" value={eventId} />
        <p className="text-sm text-muted">
          Each date becomes its own event with these details, the menu (as a draft) and the volunteer shifts. Dates that already have this event are skipped.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Repeat" htmlFor="repeat-every" errors={e?.every}>
            <Select id="repeat-every" name="every" defaultValue="1">
              <option value="1">Every week</option>
              <option value="2">Every 2 weeks</option>
              <option value="3">Every 3 weeks</option>
              <option value="4">Every 4 weeks</option>
            </Select>
          </Field>
          <Field label="How many more dates" htmlFor="repeat-count" hint="Up to 26." errors={e?.count}>
            <Input id="repeat-count" name="count" type="number" inputMode="numeric" min={1} max={26} required defaultValue={4} />
          </Field>
          <Field label="Add them as" htmlFor="repeat-status" errors={e?.status}>
            <Select id="repeat-status" name="status" defaultValue="draft">
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
            </Select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton variant="secondary">Add dates</SubmitButton>
          <FormMessage state={state} />
        </div>
      </Form>
    </details>
  );
}
