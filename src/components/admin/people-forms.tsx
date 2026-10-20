"use client";

import { useActionState, useState, useTransition } from "react";
import { X } from "lucide-react";
import { grantRole, removePendingGrant, revokeRole } from "@/app/admin/people/actions";
import { SITE } from "@/config/site";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Form } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/form-message";

export function GrantRoleForm() {
  const [state, action] = useActionState(grantRole, initialActionState);
  const e = state.ok ? undefined : state.fieldErrors;
  return (
    <Form action={action} state={state} resetOnSuccess className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="Email" htmlFor="grant-email" errors={e?.email} required>
          <Input id="grant-email" name="email" type="email" required placeholder={`name@${SITE.campus.studentEmailDomains[0]}`} />
        </Field>
        <Field label="Role" htmlFor="grant-role" errors={e?.role}>
          <Select id="grant-role" name="role" defaultValue="organizer">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <SubmitButton>Give role</SubmitButton>
      <FormMessage state={state} />
    </Form>
  );
}

/** A role chip with a remove button (admins only). */
export function RoleChip({ userId, name, role, label }: { userId: string; name: string; role: Role; label: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex min-h-11 items-center rounded-full border border-stone-200 bg-stone-50 pl-3 text-sm font-semibold text-ink">
        {label}
        {/* A full 44px tap target inside the chip, so it never overlaps the chip next to it. */}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Remove the ${label} role from ${name}?`)) start(async () => setResult(await revokeRole(userId, role)));
          }}
          className="group flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
          aria-label={`Remove ${label} role from ${name}`}
        >
          <span className="flex size-7 items-center justify-center rounded-full group-hover:bg-stone-200">
            <X className="size-4" aria-hidden="true" />
          </span>
        </button>
      </span>
      {result && !result.ok ? <span role="alert" className="mt-1 text-sm text-red-700">{result.error}</span> : null}
    </span>
  );
}

export function PendingGrantChip({ email, role, label }: { email: string; role: Role; label: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (confirm(`Cancel the pending ${label} role for ${email}?`)) start(async () => setResult(await removePendingGrant(email, role)));
        }}
        className="inline-flex min-h-11 items-center gap-1 rounded-full border border-dashed border-stone-300 px-3 text-sm font-semibold text-muted hover:text-ink"
        aria-label={`Cancel pending ${label} role for ${email}`}
      >
        {label} <X className="size-3.5" aria-hidden="true" />
      </button>
      {result && !result.ok ? <span role="alert" className="mt-1 text-sm text-red-700">{result.error}</span> : null}
    </span>
  );
}
