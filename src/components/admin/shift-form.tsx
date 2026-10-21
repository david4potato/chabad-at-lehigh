"use client";

import { useActionState, useState, useTransition } from "react";
import { SITE } from "@/config/site";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { formatShortDate, toDateTimeLocalValue } from "@/lib/time";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Form } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/form-message";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

export type ShiftFormValues = {
  id: string;
  title: string;
  event_id: string | null;
  starts_at: string;
  ends_at: string | null;
  slots: number;
  description: string | null;
  status: "draft" | "open" | "closed";
};

export type ShiftFormEvent = { id: string; title: string; starts_at: string; status: string };

const STATUS_HINT =
  "Open: people can sign up. Closed: no new sign-ups. Draft: only organizers see it.";

/** Create or edit a volunteer shift (organizers). */
export function ShiftForm({
  action,
  shift,
  events,
  defaultEventId,
  signupCount = 0,
  started = false,
  onDelete,
}: {
  action: Action;
  shift?: ShiftFormValues;
  events: ShiftFormEvent[];
  /** Preselected event for a new shift (from ?event=). */
  defaultEventId?: string;
  signupCount?: number;
  /** The shift has started (deleting it then notifies nobody). */
  started?: boolean;
  onDelete?: (id: string) => Promise<ActionResult>;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [deleteState, setDeleteState] = useState<ActionResult | null>(null);
  const e = state.ok ? undefined : state.fieldErrors;

  return (
    <div className="space-y-4">
      <Form action={formAction} className="space-y-4 rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm md:p-6">
        {shift ? <input type="hidden" name="id" value={shift.id} /> : null}
        <Field label="What's the job?" htmlFor="shift-title" hint="For example: Help cook Shabbat dinner" errors={e?.title} required>
          <Input id="shift-title" name="title" required minLength={3} maxLength={140} defaultValue={shift?.title ?? ""} />
        </Field>
        <Field label="Event" htmlFor="shift-event" hint="Optional. The shift also shows on that event's page. For a draft event, it stays hidden until the event is published." errors={e?.event_id}>
          <Select id="shift-event" name="event_id" defaultValue={shift ? (shift.event_id ?? "") : (defaultEventId ?? "")}>
            <option value="">No event</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {formatShortDate(ev.starts_at)} · {ev.title}
                {ev.status === "draft" ? " (draft)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Starts" htmlFor="shift-starts" hint={SITE.timeZoneLabel} errors={e?.starts_at} required>
            <Input id="shift-starts" name="starts_at" type="datetime-local" required defaultValue={toDateTimeLocalValue(shift?.starts_at)} />
          </Field>
          <Field label="Ends" htmlFor="shift-ends" hint="Optional. Keep shifts to 2 hours or less; split longer cooking into two shifts." errors={e?.ends_at}>
            <Input id="shift-ends" name="ends_at" type="datetime-local" defaultValue={toDateTimeLocalValue(shift?.ends_at)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Spots" htmlFor="shift-slots" hint="How many helpers you need (1 to 500)." errors={e?.slots} required>
            <Input
              id="shift-slots"
              name="slots"
              type="number"
              inputMode="numeric"
              min={1}
              max={500}
              step={1}
              required
              defaultValue={shift?.slots ?? 3}
            />
          </Field>
          <Field label="Status" htmlFor="shift-status" hint={STATUS_HINT} errors={e?.status}>
            <Select id="shift-status" name="status" defaultValue={shift?.status ?? "open"}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="draft">Draft (hidden)</option>
            </Select>
          </Field>
        </div>
        <Field label="Details" htmlFor="shift-description" hint="Optional. Where to meet, what to bring, who to ask for." errors={e?.description}>
          <Textarea id="shift-description" name="description" rows={3} maxLength={2000} defaultValue={shift?.description ?? ""} />
        </Field>
        {shift ? null : (
          <Field
            label="Repeat"
            htmlFor="shift-repeat"
            hint="Adds the same shift each week at this time, like a weekly cooking crew. For a shift on an event, repeat the event instead."
            errors={e?.repeat_weeks}
          >
            <Select id="shift-repeat" name="repeat_weeks" defaultValue="0">
              <option value="0">Just once</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  Every week, {n} more {n === 1 ? "week" : "weeks"}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>{shift ? "Save shift" : "Create shift"}</SubmitButton>
        </div>
        <FormMessage state={state} />
      </Form>

      {shift && onDelete ? (
        <div className="space-y-3 rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 md:p-6">
          <h2 className="text-lg font-bold text-ink">Delete this shift</h2>
          {!confirmDelete ? (
            <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
              Delete shift
            </Button>
          ) : (
            <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p>
                This removes the shift and its sign-ups for good.
                {signupCount > 0
                  ? started
                    ? ` ${signupCount} ${signupCount === 1 ? "person was" : "people were"} signed up. The shift has started, so nobody gets a notification.`
                    : ` ${signupCount} ${signupCount === 1 ? "person is" : "people are"} signed up. They get a notification. To stop new sign-ups instead, set the status to Closed.`
                  : null}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  disabled={deleting}
                  onClick={() => startDelete(async () => setDeleteState(await onDelete(shift.id)))}
                >
                  Yes, delete it
                </Button>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </Button>
              </div>
            </div>
          )}
          <FormMessage state={deleteState} />
        </div>
      ) : null}
    </div>
  );
}
