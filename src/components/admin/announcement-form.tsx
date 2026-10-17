"use client";

import { useActionState, useState, useTransition } from "react";
import { saveAnnouncement, deleteAnnouncement } from "@/app/admin/announcements/actions";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { toDateTimeLocalValue } from "@/lib/time";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Form } from "@/components/ui/form";
import { FormMessage } from "@/components/ui/form-message";

export type AnnouncementRow = {
  id: string;
  title: string;
  body: string | null;
  audience: string;
  status: string;
  is_pinned: boolean;
  is_urgent: boolean;
  publish_at: string;
  expires_at: string | null;
  event_id: string | null;
};

export function AnnouncementForm({
  announcement,
  events,
  onDone,
}: {
  announcement?: AnnouncementRow;
  events: { id: string; title: string }[];
  onDone?: () => void;
}) {
  const [state, action] = useActionState(saveAnnouncement, initialActionState);
  const [del, setDel] = useState<ActionResult | null>(null);
  const [deleting, startDelete] = useTransition();
  const e = state.ok ? undefined : state.fieldErrors;
  const p = announcement?.id ?? "new";

  return (
    <Form action={action} state={state} resetOnSuccess={!announcement} className="space-y-4">
      <input type="hidden" name="id" value={announcement?.id ?? ""} />
      <Field label="Title" htmlFor={`title-${p}`} errors={e?.title} required>
        <Input id={`title-${p}`} name="title" required minLength={3} maxLength={140} defaultValue={announcement?.title ?? ""} />
      </Field>
      <Field label="Message" htmlFor={`body-${p}`} errors={e?.body}>
        <Textarea id={`body-${p}`} name="body" rows={4} maxLength={4000} defaultValue={announcement?.body ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Who sees it" htmlFor={`audience-${p}`}>
          <Select id={`audience-${p}`} name="audience" defaultValue={announcement?.audience ?? "public"}>
            <option value="public">Everyone</option>
            <option value="members">Signed-in members</option>
          </Select>
        </Field>
        <Field label="Status" htmlFor={`status-${p}`}>
          <Select id={`status-${p}`} name="status" defaultValue={announcement?.status ?? "published"}>
            <option value="published">Published</option>
            <option value="draft">Draft (hidden)</option>
          </Select>
        </Field>
        <Field label="Related event" htmlFor={`event-${p}`} hint="Optional">
          <Select id={`event-${p}`} name="event_id" defaultValue={announcement?.event_id ?? ""}>
            <option value="">None</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Show from" htmlFor={`publish-${p}`} hint="Blank = now" errors={e?.publish_at}>
          <Input id={`publish-${p}`} name="publish_at" type="datetime-local" defaultValue={toDateTimeLocalValue(announcement?.publish_at)} />
        </Field>
        <Field label="Hide after" htmlFor={`expires-${p}`} hint="Blank = keep showing" errors={e?.expires_at}>
          <Input id={`expires-${p}`} name="expires_at" type="datetime-local" defaultValue={toDateTimeLocalValue(announcement?.expires_at)} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6">
        <Checkbox name="is_pinned" label="Pin to the top" defaultChecked={announcement?.is_pinned ?? false} />
        <Checkbox name="is_urgent" label="Mark as important" defaultChecked={announcement?.is_urgent ?? false} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SubmitButton>{announcement ? "Save" : "Post announcement"}</SubmitButton>
        {announcement ? (
          <Button
            variant="ghost"
            className="text-red-700 hover:bg-red-50"
            disabled={deleting}
            onClick={() => {
              if (!confirm("Delete this announcement?")) return;
              startDelete(async () => {
                const r = await deleteAnnouncement(announcement.id);
                setDel(r);
                if (r.ok) onDone?.();
              });
            }}
          >
            Delete
          </Button>
        ) : null}
      </div>
      <FormMessage state={state} />
      <FormMessage state={del} />
    </Form>
  );
}
