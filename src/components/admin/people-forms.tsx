"use client";

import { useActionState, useState, useTransition } from "react";
import { X } from "lucide-react";
import { grantRole, removePendingGrant, revokeRole } from "@/app/admin/people/actions";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function GrantRoleForm() {
  const [state, action] = useActionState(grantRole, initialActionState);
  const e = state.ok ? undefined : state.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="Email" htmlFor="grant-email" errors={e?.email} required>
          <Input id="grant-email" name="email" type="email" required placeholder="name@lehigh.edu" />
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
    </form>
  );
}

/** A role chip with a remove button (admins only). */
export function RoleChip({ userId, role, label }: { userId: string; role: Role; label: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <span className="inline-flex flex-col">
      <span className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-stone-50 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-ink">
        {label}
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (confirm(`Remove the ${label} role?`)) start(async () => setResult(await revokeRole(userId, role)));
          }}
          className="flex size-6 items-center justify-center rounded-full text-muted hover:bg-stone-200 hover:text-ink"
          aria-label={`Remove ${label} role`}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </span>
      {result && !result.ok ? <span role="alert" className="mt-1 text-xs text-red-700">{result.error}</span> : null}
    </span>
  );
}

export function PendingGrantChip({ email, role, label }: { email: string; role: Role; label: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(async () => void (await removePendingGrant(email, role)))}
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-stone-300 px-2.5 py-1 text-xs font-semibold text-muted hover:text-ink"
      aria-label={`Cancel pending ${label} role for ${email}`}
    >
      {label} <X className="size-3.5" aria-hidden="true" />
    </button>
  );
}
