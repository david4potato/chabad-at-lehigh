"use client";

import { useActionState, useState, useTransition } from "react";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { toDateTimeLocalValue } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Form } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/form-message";
import type { AdminEvent } from "@/lib/data/admin";

type Action = (prev: ActionResult, formData: FormData) => Promise<ActionResult>;

const APPROVAL_OPTIONS = [
  { value: "auto", label: "Confirm everyone automatically", hint: "People are confirmed while space remains; then they join the waitlist." },
  { value: "guests_need_approval", label: "Guests and community members need approval", hint: "Lehigh students are confirmed automatically. You approve plus-ones and community guests." },
  { value: "all_need_approval", label: "Every RSVP needs approval", hint: "You confirm each person on the Attendees tab." },
];

function Section({ title, children, description }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 rounded-[var(--radius-card)] border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div>
        <h2 className="text-lg font-bold text-ink" aria-hidden="true">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted">{description}</p> : null}
      </div>
      {children}
    </fieldset>
  );
}

export function EventForm({
  action,
  event,
  defaults,
  canDelete,
  onDuplicate,
  onDelete,
}: {
  action: Action;
  event?: AdminEvent;
  /** Pre-filled values for a new event (e.g. the usual location). */
  defaults?: { location_name?: string; location_address?: string };
  canDelete?: boolean;
  onDuplicate?: (id: string) => Promise<ActionResult>;
  onDelete?: (id: string) => Promise<ActionResult>;
}) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [approval, setApproval] = useState(event?.approval_mode ?? "auto");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, startBusy] = useTransition();
  const [extraState, setExtraState] = useState<ActionResult | null>(null);
  const e = state.ok ? undefined : state.fieldErrors;

  return (
    <div className="space-y-5">
      <Form action={formAction} className="space-y-5">
        {event ? <input type="hidden" name="id" value={event.id} /> : null}

        <Section title="Basics">
          <Field label="Title" htmlFor="title" errors={e?.title} required>
            <Input id="title" name="title" required minLength={3} maxLength={140} defaultValue={event?.title ?? ""} placeholder="Shabbat Dinner" />
          </Field>
          <Field label="Short summary" htmlFor="summary" hint="One sentence shown on event cards." errors={e?.summary}>
            <Input id="summary" name="summary" maxLength={280} defaultValue={event?.summary ?? ""} />
          </Field>
          <Field label="Description" htmlFor="description" errors={e?.description}>
            <Textarea id="description" name="description" rows={5} maxLength={5000} defaultValue={event?.description ?? ""} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category" htmlFor="category" errors={e?.category}>
              <Select id="category" name="category" defaultValue={event?.category ?? "shabbat_dinner"}>
                <option value="shabbat_dinner">Shabbat dinner</option>
                <option value="holiday">Holiday</option>
                <option value="learning">Learning</option>
                <option value="social">Social</option>
                <option value="volunteer">Volunteer</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field
              label="Status"
              htmlFor="status"
              hint="Drafts are only visible to staff. Choosing Cancelled notifies everyone who RSVP'd in the app."
              errors={e?.status}
            >
              <Select id="status" name="status" defaultValue={event?.status ?? "draft"}>
                <option value="draft">Draft (hidden)</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled (shown as cancelled)</option>
              </Select>
            </Field>
          </div>
          <Field label="Who can see it" htmlFor="visibility" errors={e?.visibility}>
            <Select id="visibility" name="visibility" defaultValue={event?.visibility ?? "public"}>
              <option value="public">Everyone</option>
              <option value="members">Signed-in members only</option>
            </Select>
          </Field>
        </Section>

        <Section
          title="When and where"
          description="Times are in Bethlehem, PA time. Once published, changing the start time or place notifies everyone who RSVP'd in the app."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="starts_at" errors={e?.starts_at} required>
              <Input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={toDateTimeLocalValue(event?.starts_at)} />
            </Field>
            <Field label="Ends" htmlFor="ends_at" hint="Optional" errors={e?.ends_at}>
              <Input id="ends_at" name="ends_at" type="datetime-local" defaultValue={toDateTimeLocalValue(event?.ends_at)} />
            </Field>
          </div>
          <Field label="Place name" htmlFor="location_name" errors={e?.location_name}>
            <Input id="location_name" name="location_name" maxLength={140} defaultValue={event?.location_name ?? defaults?.location_name ?? ""} placeholder="Chabad House" />
          </Field>
          <Field label="Street address" htmlFor="location_address" hint="Optional — adds a map link." errors={e?.location_address}>
            <Input id="location_address" name="location_address" maxLength={280} defaultValue={event?.location_address ?? defaults?.location_address ?? ""} />
          </Field>
        </Section>

        <Section title="RSVPs">
          <Checkbox name="rsvp_enabled" label="Accept RSVPs" defaultChecked={event?.rsvp_enabled ?? true} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Capacity" htmlFor="capacity" hint="Blank = unlimited" errors={e?.capacity}>
              <Input id="capacity" name="capacity" type="number" min={1} max={5000} defaultValue={event?.capacity ?? ""} />
            </Field>
            <Field label="Guests per person" htmlFor="max_guests_per_rsvp" hint="0 = no plus-ones" errors={e?.max_guests_per_rsvp}>
              <Input id="max_guests_per_rsvp" name="max_guests_per_rsvp" type="number" min={0} max={10} defaultValue={event?.max_guests_per_rsvp ?? 0} />
            </Field>
            <Field label="RSVP deadline" htmlFor="rsvp_deadline" hint="Optional" errors={e?.rsvp_deadline}>
              <Input id="rsvp_deadline" name="rsvp_deadline" type="datetime-local" defaultValue={toDateTimeLocalValue(event?.rsvp_deadline)} />
            </Field>
          </div>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Who gets confirmed?</legend>
            <div className="mt-2 space-y-2">
              {APPROVAL_OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-3",
                    approval === o.value ? "border-brand-700 bg-brand-50" : "border-stone-300 bg-white",
                  )}
                >
                  <input
                    type="radio"
                    name="approval_mode"
                    value={o.value}
                    checked={approval === o.value}
                    onChange={() => setApproval(o.value as typeof approval)}
                    className="mt-1 size-4 accent-brand-700"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{o.label}</span>
                    <span className="block text-sm text-muted">{o.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </Section>

        <Section title="Food">
          <Checkbox name="has_meal" label="This event has a meal" hint="Shows the menu section on the event page." defaultChecked={event?.has_meal ?? true} />
          <Checkbox
            name="menu_voting_open"
            label="Let people vote on proposed dishes"
            hint="Add the options on the Menu tab. Votes are advisory."
            defaultChecked={event?.menu_voting_open ?? false}
          />
        </Section>

        <Section title="Contact" description="Leave blank to use the organization's contact from Settings.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" htmlFor="contact_name" errors={e?.contact_name}>
              <Input id="contact_name" name="contact_name" maxLength={120} defaultValue={event?.contact_name ?? ""} />
            </Field>
            <Field label="Email" htmlFor="contact_email" errors={e?.contact_email}>
              <Input id="contact_email" name="contact_email" type="email" maxLength={254} defaultValue={event?.contact_email ?? ""} />
            </Field>
            <Field label="Phone" htmlFor="contact_phone" errors={e?.contact_phone}>
              <Input id="contact_phone" name="contact_phone" type="tel" maxLength={40} defaultValue={event?.contact_phone ?? ""} />
            </Field>
          </div>
          <Field
            label="Web address"
            htmlFor="slug"
            hint={
              event && event.status !== "draft"
                ? "Changing this breaks links already shared and in people's notifications."
                : "Leave blank to create one from the title and date."
            }
            errors={e?.slug}
          >
            <Input id="slug" name="slug" maxLength={80} defaultValue={event?.slug ?? ""} placeholder="shabbat-dinner-2026-10-23" />
          </Field>
        </Section>

        <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex flex-wrap items-center gap-3 rounded-2xl border border-stone-200 bg-white/95 p-3 shadow-lg backdrop-blur md:bottom-4">
          <SubmitButton size="lg">{event ? "Save event" : "Create event"}</SubmitButton>
          <div className="min-w-0 flex-1">
            <FormMessage state={state} />
          </div>
        </div>
      </Form>

      {event && (onDuplicate || onDelete) ? (
        <div className="space-y-3 rounded-[var(--radius-card)] border border-stone-200 bg-white p-5">
          <h2 className="text-lg font-bold text-ink">More actions</h2>
          <div className="flex flex-wrap gap-2">
            {onDuplicate ? (
              <Button variant="secondary" disabled={busy} onClick={() => startBusy(async () => setExtraState(await onDuplicate(event.id)))}>
                Duplicate for next week
              </Button>
            ) : null}
            {canDelete && onDelete && !confirmDelete ? (
              <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
                Delete event
              </Button>
            ) : null}
          </div>
          {confirmDelete && onDelete ? (
            <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              <p>
                Deleting removes the event, its RSVPs and menus permanently. If people already RSVP&apos;d, it&apos;s usually
                better to set the status to <strong>Cancelled</strong> so they see what happened.
              </p>
              <div className="flex gap-2">
                <Button variant="danger" disabled={busy} onClick={() => startBusy(async () => setExtraState(await onDelete(event.id)))}>
                  Yes, delete permanently
                </Button>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Keep it
                </Button>
              </div>
            </div>
          ) : null}
          <FormMessage state={extraState} />
        </div>
      ) : null}
    </div>
  );
}
