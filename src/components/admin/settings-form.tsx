"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/admin/settings/actions";
import { initialActionState } from "@/lib/action-result";
import type { OrgSettings } from "@/lib/settings";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Card, CardTitle } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { Form } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/form-message";

export function SettingsForm({ org, domains }: { org: OrgSettings; domains: string[] }) {
  const [state, action] = useActionState(saveSettings, initialActionState);
  const e = state.ok ? undefined : state.fieldErrors;
  return (
    <Form action={action} className="space-y-4">
      <Card className="space-y-4">
        <CardTitle>Organization & contact</CardTitle>
        <p className="text-sm text-muted">Shown in the footer, on Find Us, and next to every menu for allergy questions.</p>
        <Field label="Organization name" htmlFor="name" errors={e?.name} required>
          <Input id="name" name="name" required maxLength={120} defaultValue={org.name} />
        </Field>
        <Field label="Contact name" htmlFor="contact_name" errors={e?.contact_name}>
          <Input id="contact_name" name="contact_name" maxLength={120} defaultValue={org.contact_name} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact email" htmlFor="contact_email" errors={e?.contact_email}>
            <Input id="contact_email" name="contact_email" type="email" maxLength={254} defaultValue={org.contact_email} />
          </Field>
          <Field label="Contact phone" htmlFor="contact_phone" errors={e?.contact_phone}>
            <Input id="contact_phone" name="contact_phone" type="tel" maxLength={40} defaultValue={org.contact_phone} />
          </Field>
        </div>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Find Us page</CardTitle>
        <Field label="Address" htmlFor="address" errors={e?.address}>
          <Textarea id="address" name="address" rows={3} maxLength={280} defaultValue={org.address} />
        </Field>
        <Field label="Map search text" htmlFor="map_query" hint="Optional — what to search in Google/Apple Maps if the address alone isn't precise." errors={e?.map_query}>
          <Input id="map_query" name="map_query" maxLength={280} defaultValue={org.map_query} />
        </Field>
        <Field label="Directions" htmlFor="directions" hint="e.g. walking directions from the center of campus." errors={e?.directions}>
          <Textarea id="directions" name="directions" rows={6} maxLength={2000} defaultValue={org.directions} />
        </Field>
        <Field label="Parking" htmlFor="parking" errors={e?.parking}>
          <Textarea id="parking" name="parking" rows={3} maxLength={1000} defaultValue={org.parking} />
        </Field>
      </Card>

      <Card className="space-y-4">
        <CardTitle>Student email domains</CardTitle>
        <Field
          label="Domains"
          htmlFor="student_email_domains"
          hint="New accounts with these addresses get the Student role automatically. Existing accounts don't change; give them the role in People & roles. Separate with commas."
          errors={e?.student_email_domains}
        >
          <Input id="student_email_domains" name="student_email_domains" maxLength={500} defaultValue={domains.join(", ")} />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lg">Save settings</SubmitButton>
        <FormMessage state={state} />
      </div>
    </Form>
  );
}
