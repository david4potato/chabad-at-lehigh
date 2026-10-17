import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canManageEvents, isAdmin } from "@/lib/roles";
import { getAdminEvent } from "@/lib/data/admin";
import { Alert } from "@/components/ui/alert";
import { EventTabs } from "@/components/admin/event-tabs";
import { AdminEventHeader } from "@/components/admin/event-header";
import { EventForm } from "@/components/admin/event-form";
import { deleteEvent, duplicateEvent, updateEvent } from "../actions";

export const metadata: Metadata = { title: "Edit event" };

export default async function EditEventPage({ params, searchParams }: PageProps<"/admin/events/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const viewer = await requireRole(["organizer", "kitchen_staff", "admin"], `/admin/events/${id}`);
  if (!canManageEvents(viewer.roles)) redirect(`/admin/events/${id}/menu`);
  const event = await getAdminEvent(id);

  return (
    <div className="mx-auto max-w-3xl">
      <AdminEventHeader event={event} />
      <EventTabs eventId={event.id} active="details" roles={viewer.roles} />
      {query.saved ? <Alert tone="success" className="mb-4">Event created. Publish it when you&apos;re ready.</Alert> : null}
      {query.duplicated ? (
        <Alert tone="success" className="mb-4">
          Copied as a draft one week later. Check the details, then set the status to Published.
        </Alert>
      ) : null}
      <EventForm
        action={updateEvent}
        event={event}
        canDelete={isAdmin(viewer.roles)}
        onDuplicate={duplicateEvent}
        onDelete={deleteEvent}
      />
    </div>
  );
}
