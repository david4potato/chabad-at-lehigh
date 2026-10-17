"use client";

import { useActionState, useState, useTransition } from "react";
import { Info } from "lucide-react";
import { saveDietary, deleteDietary } from "@/app/profile/actions";
import { ALLERGENS, DIETS, SEVERITY_LABELS, type Severity } from "@/lib/allergens";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

type Initial = {
  allergens: { code: string; severity: Severity; notes: string | null }[];
  diets: string[];
  other_restrictions: string | null;
  notes_for_kitchen: string | null;
  carries_epinephrine: boolean;
  share_with_kitchen: boolean;
  hasData: boolean;
};

export function DietaryForm({ initial, welcome, next }: { initial: Initial; welcome: boolean; next: string }) {
  const [state, action] = useActionState(saveDietary, initialActionState);
  const [selected, setSelected] = useState(() => new Map(initial.allergens.map((a) => [a.code, a])));
  const [share, setShare] = useState(initial.share_with_kitchen);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteState, setDeleteState] = useState<ActionResult | null>(null);
  const [deleting, startDelete] = useTransition();
  // Bumped after deleting so the form remounts with the (now empty) saved values.
  const [formKey, setFormKey] = useState(0);

  const toggle = (code: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (on) next.set(code, { code, severity: "allergy", notes: null });
      else next.delete(code);
      return next;
    });

  return (
    <div className="space-y-6">
      <form key={formKey} action={action} className="space-y-8">
        {welcome ? <input type="hidden" name="welcome" value="1" /> : null}
        <input type="hidden" name="next" value={next} />

        <fieldset className="space-y-3">
          <legend className="text-lg font-bold text-ink">Food allergies and intolerances</legend>
          <div className="flex gap-2 rounded-xl bg-brand-50 p-3 text-sm text-brand-900">
            <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              <strong>Sesame seeds</strong> and <strong>sesame oil</strong> are listed separately. Most people with a
              sesame allergy should select both — follow your doctor&apos;s advice. Likewise, <strong>wheat</strong> and{" "}
              <strong>gluten</strong> are separate.
            </p>
          </div>
          <ul className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {ALLERGENS.map((a) => {
              const entry = selected.get(a.code);
              return (
                <li key={a.code} className={cn("p-3 sm:p-4", entry && "bg-amber-50/50")}>
                  <label className="flex min-h-8 cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      name="allergen"
                      value={a.code}
                      checked={Boolean(entry)}
                      onChange={(e) => toggle(a.code, e.target.checked)}
                      className="size-5 shrink-0 rounded accent-brand-700"
                    />
                    <span className="font-semibold text-ink">{a.label}</span>
                  </label>
                  {entry ? (
                    <div className="mt-3 grid gap-3 pl-8 sm:grid-cols-[220px_1fr]">
                      <div className="space-y-1">
                        <label htmlFor={`severity_${a.code}`} className="text-xs font-semibold text-muted">
                          How serious?
                        </label>
                        <Select id={`severity_${a.code}`} name={`severity_${a.code}`} defaultValue={entry.severity}>
                          {Object.entries(SEVERITY_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label htmlFor={`notes_${a.code}`} className="text-xs font-semibold text-muted">
                          Note (optional)
                        </label>
                        <Input id={`notes_${a.code}`} name={`notes_${a.code}`} maxLength={300} defaultValue={entry.notes ?? ""} placeholder="e.g. even traces" />
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-lg font-bold text-ink">Diet</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {DIETS.map((d) => (
              <Checkbox key={d.code} name="diet" value={d.code} label={d.label} defaultChecked={initial.diets.includes(d.code)} />
            ))}
          </div>
        </fieldset>

        <div className="space-y-5">
          <Field label="Other restrictions" htmlFor="other_restrictions" hint="Anything not listed above.">
            <Textarea id="other_restrictions" name="other_restrictions" maxLength={1000} defaultValue={initial.other_restrictions ?? ""} aria-describedby="other_restrictions-hint" />
          </Field>
          <Field label="Notes for the kitchen" htmlFor="notes_for_kitchen" hint="For example, how your allergy affects you or what helps.">
            <Textarea id="notes_for_kitchen" name="notes_for_kitchen" maxLength={1000} defaultValue={initial.notes_for_kitchen ?? ""} aria-describedby="notes_for_kitchen-hint" />
          </Field>
          <Checkbox name="carries_epinephrine" label="I carry an epinephrine auto-injector (e.g. EpiPen)" defaultChecked={initial.carries_epinephrine} />
        </div>

        <div className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
          <Checkbox
            name="share_with_kitchen"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
            label="Share these details with kitchen staff for events I RSVP to"
            hint="Kitchen staff and admins use them only to prepare food. Every view is logged."
          />
          {!share ? (
            <Alert tone="warning">
              The kitchen won&apos;t see your needs. Please contact the organizer directly before each event.
            </Alert>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton size="lg">{welcome ? "Save and continue" : "Save"}</SubmitButton>
          {welcome ? (
            <a href={next} className="inline-flex min-h-11 items-center px-2 font-semibold text-muted hover:text-ink">
              Skip for now
            </a>
          ) : null}
        </div>
        <FormMessage state={state} />
      </form>

      {initial.hasData && !welcome ? (
        <div className="border-t border-stone-200 pt-6">
          {!confirmDelete ? (
            <Button variant="ghost" className="text-red-700 hover:bg-red-50" onClick={() => setConfirmDelete(true)}>
              Delete my dietary information
            </Button>
          ) : (
            <div className="space-y-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-900">
                This permanently deletes your allergies, diet, notes and per-event meal notes. Organizers will no longer
                have this information.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  disabled={deleting}
                  onClick={() =>
                    startDelete(async () => {
                      const result = await deleteDietary();
                      setDeleteState(result);
                      if (result.ok) {
                        setSelected(new Map());
                        setShare(true);
                        setConfirmDelete(false);
                        setFormKey((k) => k + 1);
                      }
                    })
                  }
                >
                  {deleting ? "Deleting…" : "Yes, delete it"}
                </Button>
                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
      {/* Outside the block above: it disappears once nothing is saved. */}
      <FormMessage state={deleteState} />
    </div>
  );
}
