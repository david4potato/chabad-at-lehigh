"use client";

import { useActionState } from "react";
import { grantRole } from "@/app/admin/people/actions";
import { initialActionState } from "@/lib/action-result";
import { ROLE_LABELS, type Role } from "@/lib/roles";
import { Field, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Form } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/form-message";

/**
 * "Add a role" on a person's page. Uses the same grantRole action as People & roles
 * (it checks admin on the server); the email comes from their profile.
 */
export function PersonRoleForm({ email, available }: { email: string; available: Role[] }) {
  const [state, action] = useActionState(grantRole, initialActionState);
  const e = state.ok ? undefined : state.fieldErrors;
  if (available.length === 0) return <FormMessage state={state} />;
  return (
    <Form action={action} state={state} className="space-y-3">
      <input type="hidden" name="email" value={email} />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field label="Add a role" htmlFor="person-role" errors={e?.role} className="sm:w-60">
          <Select id="person-role" name="role" defaultValue={available[0]} key={available.join(",")}>
            {available.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton variant="secondary">Give role</SubmitButton>
      </div>
      <FormMessage state={state} />
    </Form>
  );
}
