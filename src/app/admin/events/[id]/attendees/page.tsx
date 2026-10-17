import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getAdminEvent } from "@/lib/data/admin";
import { getAttendees } from "@/lib/data/attendees";
import { getEventCounts } from "@/lib/data/events";
import { EventTabs } from "@/components/admin/event-tabs";
import { AdminEventHeader } from "@/components/admin/event-header";
import { AttendeeList } from "@/components/admin/attendee-list";
import { InvitePeople } from "@/components/admin/invite-people";
import { Card, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Attendees" };

export default async function AttendeesPage({ params }: PageProps<"/admin/events/[id]/attendees">) {
  const { id } = await params;
  const viewer = await requireRole(["organizer", "admin"], `/admin/events/${id}/attendees`);
  const event = await getAdminEvent(id);
  const [attendees, counts] = await Promise.all([getAttendees(event.id), getEventCounts([event.id])]);
  const c = counts.get(event.id);

  const tiles = [
    { label: "Going", value: c?.going ?? 0 },
    { label: "Approved guests", value: c?.guests ?? 0 },
    { label: "Seats taken", value: event.capacity ? `${c?.seatsTaken ?? 0} / ${event.capacity}` : (c?.seatsTaken ?? 0) },
    { label: "Waitlist", value: c?.waitlist ?? 0 },
    { label: "Needs approval", value: c?.pending ?? 0, highlight: (c?.pending ?? 0) > 0 },
    { label: "Checked in", value: attendees.filter((a) => a.checked_in_at).length },
  ];

  return (
    <div>
      <AdminEventHeader event={event} />
      <EventTabs eventId={event.id} active="attendees" roles={viewer.roles} />
      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-2xl border bg-white p-3.5 shadow-sm ${t.highlight ? "border-brand-300 bg-brand-50" : "border-stone-200"}`}>
            <dt className="text-xs font-semibold text-muted">{t.label}</dt>
            <dd className="mt-0.5 text-2xl font-extrabold text-ink">{t.value}</dd>
          </div>
        ))}
      </dl>
      <AttendeeList eventId={event.id} attendees={attendees} capacity={event.capacity} seatsTaken={c?.seatsTaken ?? 0} />
      <Card className="mt-8">
        <CardTitle>Invite people</CardTitle>
        <p className="mb-4 mt-1 text-sm text-muted">Send an in-app invitation, or copy the link to share anywhere.</p>
        <InvitePeople eventId={event.id} eventPath={`/events/${event.slug}`} published={event.status === "published"} />
      </Card>
      <p className="mt-6 text-sm text-muted">Allergy and dietary details are on the Dietary tab (names are visible to kitchen staff and admins only).</p>
    </div>
  );
}
