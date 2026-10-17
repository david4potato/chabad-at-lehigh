"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
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
import { FormMessage } from "@/components/ui/form-message";
import { AllergenBadges } from "@/components/menu/allergen-badges";

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

export function DraftDetailsForm({ eventId, versionId, title, kitchenNotes }: { eventId: string; versionId: string; title: string | null; kitchenNotes: string | null }) {
  const [state, action] = useActionState(saveDraftDetails, initialActionState);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="version_id" value={versionId} />
      <Field label="Menu title" htmlFor="menu-title" hint="Optional, e.g. “Shabbat Dinner Menu”">
        <Input id="menu-title" name="title" maxLength={140} defaultValue={title ?? ""} />
      </Field>
      <Field
        label="Kitchen note (shown above the menu)"
        htmlFor="kitchen-notes"
        hint="A general cross-contact statement, e.g. “Prepared in a shared kitchen that also handles sesame, tree nuts, eggs, wheat and soy.”"
      >
        <Textarea id="kitchen-notes" name="kitchen_notes" rows={3} maxLength={2000} defaultValue={kitchenNotes ?? ""} aria-describedby="kitchen-notes-hint" />
      </Field>
      <SubmitButton variant="secondary">Save</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function MenuItemEditor({ eventId, item }: { eventId: string; item: MenuItem }) {
  const [state, action] = useActionState(updateMenuItem, initialActionState);
  const remove = useAction();
  const optionalOnly = optionalOnlyAllergens(item.dish);
  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-ink">{item.dish.name}</p>
          <div className="mt-1.5">
            {item.dish.allergens.length ? (
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
          className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
          aria-label={`Remove ${item.dish.name}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-brand-700">Edit course, preparation and cross-contact</summary>
        <form action={action} className="mt-3 space-y-4">
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
        </form>
      </details>
      <FormMessage state={remove.result} />
    </li>
  );
}

export function AddDishForm({ eventId, versionId, dishes }: { eventId: string; versionId: string; dishes: DishOption[] }) {
  const [state, action] = useActionState(addMenuItem, initialActionState);
  const byCategory = COURSE_ORDER.map((c) => ({ c, list: dishes.filter((d) => d.category === c) })).filter((g) => g.list.length);
  return (
    <form action={action} className="space-y-3">
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
        <Link href="/admin/dishes/new" className="text-sm font-semibold text-brand-700 hover:underline">
          Create a new dish
        </Link>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function PublishForm({ eventId, versionId, hasPublished, itemCount }: { eventId: string; versionId: string; hasPublished: boolean; itemCount: number }) {
  const [state, action] = useActionState(publishMenu, initialActionState);
  const discard = useAction();
  return (
    <div className="space-y-4">
      <form action={action} className="space-y-4">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="version_id" value={versionId} />
        {hasPublished ? (
          <Field
            label="What changed?"
            htmlFor="change-summary"
            hint="Required. People with allergies use this to review changes, e.g. “Swapped rice for roasted potatoes; slaw dressing now uses sesame oil.”"
          >
            <Textarea id="change-summary" name="change_summary" rows={2} maxLength={1000} required aria-describedby="change-summary-hint" />
          </Field>
        ) : null}
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
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
            label="This change affects allergens — mark it urgent and notify everyone who RSVP'd"
          />
        ) : null}
        <SubmitButton size="lg" disabled={itemCount === 0} pendingText="Publishing…">
          {hasPublished ? "Publish new version" : "Publish menu"}
        </SubmitButton>
        {itemCount === 0 ? <p className="text-sm text-muted">Add at least one dish first.</p> : null}
        <FormMessage state={state} />
      </form>
      <div className="border-t border-stone-100 pt-3">
        <Button
          variant="ghost"
          size="sm"
          className="text-red-700 hover:bg-red-50"
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
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && state.message) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="version_id" value={versionId ?? ""} />
      <Field label="Message" htmlFor="update-message" hint="e.g. “We ran out of rice pilaf; serving roasted potatoes (no allergens added).”">
        <Textarea id="update-message" name="message" rows={2} minLength={3} maxLength={1000} required aria-describedby="update-message-hint" />
      </Field>
      <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
        <AlertTriangle className="mt-1 size-4 shrink-0 text-amber-800" aria-hidden="true" />
        <Checkbox name="urgent" label="Urgent — notify everyone who RSVP'd now" hint="Use for any change involving ingredients or allergens." />
      </div>
      <SubmitButton variant="secondary">Post update</SubmitButton>
      <FormMessage state={state} />
    </form>
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
          <Button size="sm" variant="secondary" disabled={toggle.pending} onClick={() => toggle.run(() => setVotingOpen(eventId, !open))}>
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
            <li key={o.dish_id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="font-medium text-ink">{o.name}</span>
              <span className="ml-auto text-sm font-semibold text-ink">{o.votes} votes</span>
              <button
                type="button"
                onClick={() => remove.run(() => removeOption(eventId, o.dish_id))}
                className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-stone-100"
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
      <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-end">
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
      </form>
      <FormMessage state={state} />
    </div>
  );
}
