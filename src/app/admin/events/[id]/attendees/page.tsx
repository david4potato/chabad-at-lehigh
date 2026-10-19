import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { getAdminEvent } from "@/lib/data/admin";
import { getAttendees } from "@/lib/data/attendees";
import { getEventCounts } from "@/lib/data/events";
import { isPast } from "@/lib/time";
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

  // Three numbers at the door. Going and Waitlist counts are on the filter chips below.
  const tiles = [
    { label: "Seats taken", value: event.capacity ? `${c?.seatsTaken ?? 0} / ${event.capacity}` : (c?.seatsTaken ?? 0) },
    { label: "Needs approval", value: c?.pending ?? 0, highlight: (c?.pending ?? 0) > 0 },
    { label: "Checked in", value: attendees.filter((a) => a.checked_in_at).length },
  ];

  return (
    <div>
      <AdminEventHeader event={event} />
      <EventTabs eventId={event.id} active="attendees" roles={viewer.roles} />
      <dl className="mb-6 grid grid-cols-3 gap-2 sm:gap-3">
        {tiles.map((t) => (
          <div key={t.label} className={`rounded-2xl border bg-white p-3 shadow-sm sm:p-3.5 ${t.highlight ? "border-brand-300 bg-brand-50" : "border-stone-200"}`}>
            <dt className="text-xs font-semibold text-muted">{t.label}</dt>
            <dd className="mt-0.5 text-xl font-extrabold text-ink sm:text-2xl">{t.value}</dd>
          </div>
        ))}
      </dl>
      <AttendeeList
        eventId={event.id}
        attendees={attendees}
        capacity={event.capacity}
        seatsTaken={c?.seatsTaken ?? 0}
        ended={isPast(event.starts_at, event.ends_at)}
      />
      <Card className="mt-8">
        <CardTitle>Invite people</CardTitle>
        <p className="mb-4 mt-1 text-sm text-muted">Send members an in-app invitation. To share anywhere, use Copy event link at the top.</p>
        <InvitePeople eventId={event.id} published={event.status === "published"} />
      </Card>
      <p className="mt-6 text-sm text-muted">Allergy and dietary details are on the Dietary tab (names are visible to kitchen staff and admins only).</p>
      <p className="mt-2 text-sm text-muted">
        For attendance numbers, everyone going counts as having come. If you check in at least half of them, only the people you checked in count.
      </p>
    </div>
  );
}
