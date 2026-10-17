"use client";

import { useActionState, useRef, useEffect } from "react";
import { submitSuggestion } from "@/app/meals/actions";
import { initialActionState } from "@/lib/action-result";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function SuggestionForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(submitSuggestion, initialActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.ok ? undefined : state.fieldErrors;

  useEffect(() => {
    if (state.ok && state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="event_id" value={eventId} />
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <Field label="Type" htmlFor="suggestion-kind" errors={errors?.kind}>
          <Select id="suggestion-kind" name="kind" defaultValue="dish">
            <option value="dish">A dish</option>
            <option value="ingredient">An ingredient</option>
            <option value="feedback">Feedback</option>
          </Select>
        </Field>
        <Field label="Your idea" htmlFor="suggestion-title" errors={errors?.title} required>
          <Input id="suggestion-title" name="title" required minLength={2} maxLength={120} placeholder="e.g. Shakshuka" />
        </Field>
      </div>
      <Field label="Details (optional)" htmlFor="suggestion-details" errors={errors?.details}>
        <Textarea id="suggestion-details" name="details" rows={2} maxLength={1000} placeholder="Why you love it, or a recipe link" />
      </Field>
      <SubmitButton variant="secondary" pendingText="Sending…">
        Send suggestion
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
