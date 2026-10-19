"use client";

import Link from "next/link";
import { useActionState, useRef, useState, useTransition, type MouseEvent } from "react";
import { AlertTriangle, ChevronDown, Trash2 } from "lucide-react";
import {
  addMenuItem,
  addOption,
  discardDraft,
  postMenuUpdate,
  publishMenu,
  removeMenuItem,
  removeOption,
  saveDraftDetails,
  setVotingOpen,
  startDraft,
  updateMenuItem,
} from "@/app/admin/events/[id]/menu/actions";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { ALLERGENS } from "@/lib/allergens";
import { COURSE_LABELS, COURSE_ORDER, optionalOnlyAllergens, type MenuItem } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Form } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/form-message";
import { Alert } from "@/components/ui/alert";
import { AllergenBadges } from "@/components/menu/allergen-badges";
import { plural } from "@/components/events/event-utils";

export type DishOption = { id: string; name: string; category: string; status: string };

/** Runs a one-off server action (button click) and shows its result. */
function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));
  return { pending, result, run };
}

export function StartDraftButton({ eventId, hasPublished }: { eventId: string; hasPublished: boolean }) {
  const { pending, result, run } = useAction();
  return (
    <div className="space-y-2">
      <Button onClick={() => run(() => startDraft(eventId))} disabled={pending}>
        {hasPublished ? "Start a new version" : "Start the menu"}
      </Button>
      {hasPublished ? <p className="text-sm text-muted">The new draft starts as a copy of the current menu.</p> : null}
      <FormMessage state={result} />
    </div>
  );
}

/** Ids of the title and kitchen note fields; Publish copies what's typed there so nothing is lost. */
const TITLE_ID = "menu-title";
const KITCHEN_NOTES_ID = "kitchen-notes";

/** The first field in a form that differs from what was last saved, or null. */
function changedField(form: HTMLFormElement): HTMLElement | null {
  for (const el of Array.from(form.elements)) {
    if (el instanceof HTMLInputElement) {
      if (el.type === "hidden") continue;
      if (el.type === "checkbox" || el.type === "radio" ? el.checked !== el.defaultChecked : el.value !== el.defaultValue) return el;
    } else if (el instanceof HTMLTextAreaElement) {
      if (el.value !== el.defaultValue) return el;
    } else if (el instanceof HTMLSelectElement) {
      if (Array.from(el.options).some((o) => o.selected !== o.defaultSelected)) return el;
    }
  }
  return null;
}

export function DraftDetailsForm({ eventId, versionId, title, kitchenNotes }: { eventId: string; versionId: string; title: string | null; kitchenNotes: string | null }) {
  const [state, action] = useActionState(saveDraftDetails, initialActionState);
  return (
    <Form action={action} className="space-y-4">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="version_id" value={versionId} />
      <Field label="Menu title" htmlFor={TITLE_ID} hint="Optional, e.g. “Shabbat Dinner Menu”">
        <Input id={TITLE_ID} name="title" maxLength={140} defaultValue={title ?? ""} />
      </Field>
      <Field
        label="Kitchen note (shown above the menu)"
        htmlFor={KITCHEN_NOTES_ID}
        hint="A general cross-contact statement, e.g. “Prepared in a shared kitchen that also handles sesame, tree nuts, eggs, wheat and soy.”"
      >
        <Textarea id={KITCHEN_NOTES_ID} name="kitchen_notes" rows={3} maxLength={2000} defaultValue={kitchenNotes ?? ""} />
      </Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function MenuItemEditor({ eventId, item }: { eventId: string; item: MenuItem }) {
  const [state, action] = useActionState(updateMenuItem, initialActionState);
  const remove = useAction();
  const optionalOnly = optionalOnlyAllergens(item.dish);
  // A new key after each save starts the form fresh from the saved values, so Publish can tell
  // whether anything here is still unsaved.
  const savedKey = JSON.stringify([item.course, item.sort_order, item.preparation_notes, item.cross_contact_notes, item.cross_contact_allergens]);
  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{item.dish.name}</p>
          <div className="mt-1.5">
            {item.dish.ingredients.length === 0 ? (
              <p className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-sm font-medium text-amber-900">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  This dish has no ingredients yet — add them under{" "}
                  <Link href={`/admin/dishes/${item.dish.id}?event=${eventId}`} className="underline">
                    Dishes
                  </Link>{" "}
                  before publishing.
                </span>
              </p>
            ) : item.dish.allergens.length ? (
              <AllergenBadges codes={item.dish.allergens} optionalOnly={optionalOnly} label="From ingredients:" />
            ) : (
              <p className="text-xs text-muted">No allergens listed in its ingredients. Double-check the dish&apos;s ingredients.</p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (confirm(`Remove ${item.dish.name} from this menu?`)) remove.run(() => removeMenuItem(eventId, item.id));
          }}
          disabled={remove.pending}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
          aria-label={`Remove ${item.dish.name}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
      <details className="group mt-1">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
          Edit course, preparation and cross-contact
          <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <Form key={savedKey} action={action} data-dish={item.dish.name} className="mt-3 space-y-4">
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="item_id" value={item.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Course" htmlFor={`course-${item.id}`}>
              <Select id={`course-${item.id}`} name="course" defaultValue={item.course}>
                {COURSE_ORDER.map((c) => (
                  <option key={c} value={c}>
                    {COURSE_LABELS[c]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Order" htmlFor={`sort-${item.id}`} hint="Lower numbers show first">
              <Input id={`sort-${item.id}`} name="sort_order" type="number" min={0} max={999} defaultValue={item.sort_order} />
            </Field>
          </div>
          <Field label="Preparation notes" htmlFor={`prep-${item.id}`} hint="e.g. “Dressing uses toasted sesame oil, not seeds.”">
            <Textarea id={`prep-${item.id}`} name="preparation_notes" rows={2} maxLength={500} defaultValue={item.preparation_notes ?? ""} />
          </Field>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">May contain (cross-contact)</legend>
            <p className="text-xs text-muted">Allergens this dish could touch: shared trays, fryer oil, cutting boards, serving utensils.</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
              {ALLERGENS.map((a) => (
                <Checkbox key={a.code} name="cross_contact" value={a.code} label={a.label} defaultChecked={item.cross_contact_allergens.includes(a.code)} />
              ))}
            </div>
          </fieldset>
          <Field label="Cross-contact notes" htmlFor={`cc-${item.id}`} hint="e.g. “Fried in the same oil as the sesame chicken.”">
            <Textarea id={`cc-${item.id}`} name="cross_contact_notes" rows={2} maxLength={500} defaultValue={item.cross_contact_notes ?? ""} />
          </Field>
          <SubmitButton variant="secondary">Save dish details</SubmitButton>
          <FormMessage state={state} />
        </Form>
      </details>
      <FormMessage state={remove.result} />
    </li>
  );
}

export function AddDishForm({ eventId, versionId, dishes }: { eventId: string; versionId: string; dishes: DishOption[] }) {
  const [state, action] = useActionState(addMenuItem, initialActionState);
  const byCategory = COURSE_ORDER.map((c) => ({ c, list: dishes.filter((d) => d.category === c) })).filter((g) => g.list.length);
  // ?event= lets the dish pages link back to this menu.
  const newDishHref = `/admin/dishes/new?event=${eventId}`;
  if (dishes.length === 0) {
    return (
      <p className="text-sm text-muted">
        Your dish library is empty.{" "}
        <Link href={newDishHref} className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
          Create your first dish.
        </Link>
      </p>
    );
  }
  return (
    <Form action={action} state={state} resetOnSuccess className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="version_id" value={versionId} />
      <Field label="Add a dish" htmlFor="add-dish">
        <Select id="add-dish" name="dish_id" required defaultValue="">
          <option value="" disabled>
            Choose a dish…
          </option>
          {byCategory.map((g) => (
            <optgroup key={g.c} label={COURSE_LABELS[g.c]}>
              {g.list.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.status === "proposed" ? " (proposed)" : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton variant="secondary">Add to menu</SubmitButton>
        <Link href={newDishHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
          Create a new dish
        </Link>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}

export function PublishForm({
  eventId,
  versionId,
  hasPublished,
  itemCount,
  title,
  kitchenNotes,
}: {
  eventId: string;
  versionId: string;
  hasPublished: boolean;
  itemCount: number;
  /** Saved title and kitchen note: what Publish sends if the page hasn't loaded its scripts yet. */
  title: string | null;
  kitchenNotes: string | null;
}) {
  const [state, action] = useActionState(publishMenu, initialActionState);
  const discard = useAction();
  const [unsaved, setUnsaved] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLInputElement>(null);

  // Runs before the form submits. Publish saves the title and kitchen note as typed, and stops
  // while a dish's details have unsaved changes, so the confirmation below is true.
  function beforePublish(e: MouseEvent<HTMLButtonElement>) {
    for (const form of Array.from(document.querySelectorAll<HTMLFormElement>("form[data-dish]"))) {
      if (changedField(form)) {
        e.preventDefault();
        const details = form.closest("details");
        if (details) details.open = true;
        setUnsaved(`${form.dataset.dish} has unsaved changes. Tap Save dish details first.`);
        return;
      }
    }
    setUnsaved(null);
    const typedTitle = document.getElementById(TITLE_ID);
    const typedNotes = document.getElementById(KITCHEN_NOTES_ID);
    if (titleRef.current && typedTitle instanceof HTMLInputElement) titleRef.current.value = typedTitle.value;
    if (notesRef.current && typedNotes instanceof HTMLTextAreaElement) notesRef.current.value = typedNotes.value;
  }

  return (
    <div className="space-y-4">
      <Form action={action} className="space-y-4">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="version_id" value={versionId} />
        <input type="hidden" name="title" ref={titleRef} defaultValue={title ?? ""} />
        <input type="hidden" name="kitchen_notes" ref={notesRef} defaultValue={kitchenNotes ?? ""} />
        {hasPublished ? (
          <Field
            label="What changed?"
            htmlFor="change-summary"
            hint="Required. People with allergies use this to review changes, e.g. “Swapped rice for roasted potatoes; slaw dressing now uses sesame oil.”"
          >
            <Textarea id="change-summary" name="change_summary" rows={2} maxLength={1000} required />
          </Field>
        ) : null}
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1">
          <Checkbox
            name="confirm"
            required
            label="I confirm the ingredients, allergens and cross-contact notes match how this food will actually be prepared."
            hint="Required. Menus are shown with this confirmation date."
          />
        </div>
        {hasPublished ? (
          <Checkbox
            name="urgent"
            label="This change affects allergens — mark it urgent and notify everyone who RSVP'd in the app"
            hint="In-app notification only (no email or text)."
          />
        ) : null}
        <SubmitButton size="lg" disabled={itemCount === 0} pendingText="Publishing…" onClick={beforePublish}>
          {hasPublished ? "Publish new version" : "Publish menu"}
        </SubmitButton>
        {itemCount === 0 ? <p className="text-sm text-muted">Add at least one dish first.</p> : null}
        {unsaved ? <Alert tone="warning">{unsaved}</Alert> : null}
        <FormMessage state={state} />
      </Form>
      <div className="border-t border-stone-100 pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 text-red-700 hover:bg-red-50"
          disabled={discard.pending}
          onClick={() => {
            if (confirm("Discard this draft? The published menu (if any) stays as it is.")) discard.run(() => discardDraft(eventId, versionId));
          }}
        >
          Discard draft
        </Button>
        <FormMessage state={discard.result} />
      </div>
    </div>
  );
}

export function MenuUpdateForm({ eventId, versionId }: { eventId: string; versionId: string | null }) {
  const [state, action] = useActionState(postMenuUpdate, initialActionState);
  return (
    <Form action={action} state={state} resetOnSuccess className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="version_id" value={versionId ?? ""} />
      <Field label="Message" htmlFor="update-message" hint="e.g. “We ran out of rice pilaf; serving roasted potatoes instead — see the menu for its ingredients.”">
        <Textarea id="update-message" name="message" rows={2} minLength={3} maxLength={1000} required />
      </Field>
      <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1">
        <AlertTriangle className="mt-3 size-4 shrink-0 text-amber-800" aria-hidden="true" />
        <Checkbox
          name="urgent"
          label="Urgent — notify everyone who RSVP'd in the app now"
          hint="In-app notification only (no email or text). Use for any change involving ingredients or allergens."
        />
      </div>
      <SubmitButton variant="secondary">Post update</SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

export function VotingOptions({
  eventId,
  open,
  canToggle,
  options,
  dishes,
}: {
  eventId: string;
  open: boolean;
  canToggle: boolean;
  options: { dish_id: string; name: string; votes: number }[];
  dishes: DishOption[];
}) {
  const [state, action] = useActionState(addOption, initialActionState);
  const toggle = useAction();
  const remove = useAction();
  const available = dishes.filter((d) => !options.some((o) => o.dish_id === d.id));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-ink">Voting is {open ? "open" : "closed"}.</span>
        {canToggle ? (
          <Button size="sm" variant="secondary" className="min-h-11" disabled={toggle.pending} onClick={() => toggle.run(() => setVotingOpen(eventId, !open))}>
            {open ? "Close voting" : "Open voting"}
          </Button>
        ) : (
          <span className="text-xs text-muted">Organizers can open or close voting.</span>
        )}
      </div>
      <FormMessage state={toggle.result} />
      {options.length ? (
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">
          {options.map((o) => (
            <li key={o.dish_id} className="flex items-center justify-between gap-3 py-1 pl-3 pr-1">
              <span className="font-medium text-ink">{o.name}</span>
              <span className="ml-auto text-sm font-semibold text-ink">{plural(o.votes, "vote")}</span>
              <button
                type="button"
                onClick={() => remove.run(() => removeOption(eventId, o.dish_id))}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-stone-100"
                aria-label={`Remove ${o.name} from voting`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No options yet.</p>
      )}
      <FormMessage state={remove.result} />
      <Form action={action} state={state} resetOnSuccess className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <input type="hidden" name="event_id" value={eventId} />
        <Field label="Add an option" htmlFor="option-dish" className="flex-1">
          <Select id="option-dish" name="dish_id" required defaultValue="">
            <option value="" disabled>
              Choose a dish…
            </option>
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton variant="secondary">Add</SubmitButton>
      </Form>
      <FormMessage state={state} />
    </div>
  );
}
