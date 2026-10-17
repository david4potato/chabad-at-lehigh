"use client";

import { useActionState, useState } from "react";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/cn";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

const AFFILIATIONS = [
  { value: "student", label: "Lehigh student" },
  { value: "community", label: "Community member" },
  { value: "alumni", label: "Alumni" },
  { value: "parent", label: "Parent" },
  { value: "faculty_staff", label: "Faculty / staff" },
  { value: "other", label: "Other" },
];

type Profile = {
  full_name: string | null;
  preferred_name: string | null;
  affiliation: string;
  class_year: number | null;
  phone: string | null;
};

type Props = {
  action: (prev: ActionResult, formData: FormData) => Promise<ActionResult>;
  profile: Profile;
  submitLabel: string;
  next?: string;
};

export function ProfileForm({ action, profile, submitLabel, next }: Props) {
  const [state, formAction] = useActionState(action, initialActionState);
  const [affiliation, setAffiliation] = useState(profile.affiliation);
  const errors = state.ok ? undefined : state.fieldErrors;

  return (
    <form action={formAction} className="space-y-5">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Field label="Full name" htmlFor="full_name" errors={errors?.full_name} required>
        <Input id="full_name" name="full_name" autoComplete="name" required minLength={2} maxLength={120} defaultValue={profile.full_name ?? ""} />
      </Field>
      <Field label="What should we call you?" htmlFor="preferred_name" hint="Optional — a nickname or first name." errors={errors?.preferred_name}>
        <Input id="preferred_name" name="preferred_name" autoComplete="nickname" maxLength={60} defaultValue={profile.preferred_name ?? ""} aria-describedby="preferred_name-hint" />
      </Field>

      <fieldset>
        <legend className="text-sm font-semibold text-ink">I am a…</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {AFFILIATIONS.map((a) => (
            <label
              key={a.value}
              className={cn(
                "flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
                affiliation === a.value ? "border-brand-700 bg-brand-50 text-brand-900" : "border-stone-300 bg-white text-ink hover:bg-stone-50",
              )}
            >
              <input
                type="radio"
                name="affiliation"
                value={a.value}
                checked={affiliation === a.value}
                onChange={() => setAffiliation(a.value)}
                className="size-4 accent-brand-700"
              />
              {a.label}
            </label>
          ))}
        </div>
        {errors?.affiliation ? <p className="mt-1 text-sm font-medium text-red-700">{errors.affiliation[0]}</p> : null}
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        {affiliation === "student" || affiliation === "alumni" ? (
          <Field label="Class year" htmlFor="class_year" hint="Optional" errors={errors?.class_year}>
            <Input id="class_year" name="class_year" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} defaultValue={profile.class_year ?? ""} placeholder="2028" />
          </Field>
        ) : null}
        <Field label="Phone" htmlFor="phone" hint="Optional — only organizers can see it." errors={errors?.phone}>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" maxLength={40} defaultValue={profile.phone ?? ""} aria-describedby="phone-hint" />
        </Field>
      </div>

      <SubmitButton size="lg" className="w-full sm:w-auto">
        {submitLabel}
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
