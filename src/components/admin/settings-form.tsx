"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/admin/settings/actions";
import { initialActionState } from "@/lib/action-result";
import type { OrgSettings } from "@/lib/settings";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Card, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

export function SettingsForm({ org, domains }: { org: OrgSettings; domains: string[] }) {
  const [state, action] = useActionState(saveSettings, initialActionState);
  const e = state.ok ? undefined : state.fieldErrors;
  return (
    <form action={action} className="space-y-5">
      <Card className="space-y-4">
        <CardTitle>Organization & contact</CardTitle>
        <p className="text-sm text-muted">Shown in the footer, on Find Us, and next to every menu for allergy questions.</p>
        <Field label="Organization name" htmlFor="name" errors={e?.name} required>
          <Input id="name" name="name" required defaultValue={org.name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Contact name" htmlFor="contact_name" errors={e?.contact_name}>
            <Input id="contact_name" name="contact_name" defaultValue={org.contact_name} />
          </Field>
          <Field label="Contact email" htmlFor="contact_email" errors={e?.contact_email}>
            <Input id="contact_email" name="contact_email" type="email" defaultValue={org.contact_email} />
          </Field>
          <Field label="Contact phone" htmlFor="contact_phone" errors={e?.contact_phone}>
            <Input id="contact_phone" name="contact_phone" type="tel" defaultValue={org.contact_phone} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Find Us page</CardTitle>
        <Field label="Address" htmlFor="address" errors={e?.address}>
          <Textarea id="address" name="address" rows={2} defaultValue={org.address} />
        </Field>
        <Field label="Map search text" htmlFor="map_query" hint="Optional — what to search in Google/Apple Maps if the address alone isn't precise." errors={e?.map_query}>
          <Input id="map_query" name="map_query" defaultValue={org.map_query} aria-describedby="map_query-hint" />
        </Field>
        <Field label="Directions" htmlFor="directions" hint="e.g. walking directions from the center of campus." errors={e?.directions}>
          <Textarea id="directions" name="directions" rows={4} defaultValue={org.directions} aria-describedby="directions-hint" />
        </Field>
        <Field label="Parking" htmlFor="parking" errors={e?.parking}>
          <Textarea id="parking" name="parking" rows={3} defaultValue={org.parking} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Student email domains</CardTitle>
        <Field
          label="Domains"
          htmlFor="student_email_domains"
          hint="People who sign in with these addresses automatically get the Student role. Separate with commas."
          errors={e?.student_email_domains}
        >
          <Input id="student_email_domains" name="student_email_domains" defaultValue={domains.join(", ")} aria-describedby="student_email_domains-hint" />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lg">Save settings</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
