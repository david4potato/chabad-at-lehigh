import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canManageEvents, isAdmin } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getAdminEvent } from "@/lib/data/admin";
import { listShiftsForEvent } from "@/lib/data/volunteer";
import { formatEventWhen } from "@/lib/time";
import { Alert } from "@/components/ui/alert";
import { EventTabs } from "@/components/admin/event-tabs";
import { AdminEventHeader } from "@/components/admin/event-header";
import { EventForm } from "@/components/admin/event-form";
import { DuplicateEventButton } from "@/components/admin/duplicate-event-button";
import { RepeatEventForm } from "@/components/admin/repeat-event-form";
import { PublishDraftButton } from "@/components/admin/publish-draft-button";
import { EventShiftsAdmin } from "@/components/volunteer/event-shifts-admin";
import { deleteEvent, updateEvent } from "../actions";

export const metadata: Metadata = { title: "Edit event" };

/** What else "Duplicate for next week" brought along, said plainly. */
function copiedExtras(menu: boolean, shifts: boolean) {
  if (menu && shifts) return "The menu came too, as a draft to check. The volunteer shifts open when you publish.";
  if (menu) return "The menu came too, as a draft to check.";
  if (shifts) return "The volunteer shifts came too. They open when you publish.";
  return null;
}

export default async function EditEventPage({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const viewer = await requireRole(["organizer", "kitchen_staff", "admin"], `/admin/events/${id}`);
  if (!canManageEvents(viewer.roles)) redirect(`/admin/events/${id}/menu`);
  const [event, shifts] = await Promise.all([getAdminEvent(id), listShiftsForEvent(id)]);

  const justDuplicated = Boolean(query.duplicated) && event.status === "draft";
  let extras: string | null = null;
  if (justDuplicated) {
    const supabase = await createClient();
    const { count } = await supabase.from("menu_versions").select("id", { count: "exact", head: true }).eq("event_id", event.id);
    extras = copiedExtras(Boolean(count), shifts.length > 0);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <AdminEventHeader event={event} />
      <EventTabs eventId={event.id} active="details" roles={viewer.roles} />
      {query.saved ? (
        <Alert tone="success" className="mb-4">
          {event.status === "draft"
            ? "Event created as a draft. Set Status to Published when it's ready."
            : event.status === "published"
              ? "Event created and published."
              : "Event created."}
        </Alert>
      ) : null}
      {justDuplicated ? (
        <Alert tone="success" className="mb-4" title={`Copied to ${formatEventWhen(event.starts_at, event.ends_at)}, as a draft.`}>
          <p>{extras ? `${extras} ` : ""}Looks right?</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <PublishDraftButton />
            <span>Or change the details below.</span>
          </div>
        </Alert>
      ) : (
        // [DEMO] samples are deleted by Remove demo content, so they aren't offered for copying.
        !event.is_demo ? (
          <div className="mb-4">
            <DuplicateEventButton id={event.id} variant="secondary" />
            {event.status !== "cancelled" ? <RepeatEventForm eventId={event.id} /> : null}
          </div>
        ) : null
      )}
      <EventShiftsAdmin eventId={event.id} shifts={shifts} />
      <EventForm action={updateEvent} event={event} canDelete={isAdmin(viewer.roles)} onDelete={deleteEvent} />
    </div>
  );
}
