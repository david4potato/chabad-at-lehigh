import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { getShiftForAdmin, hasStarted, hiddenByEventLabel, listShiftEventOptions, SHIFT_STATUS_LABEL } from "@/lib/data/volunteer";
import { formatDateTime, formatEventWhen } from "@/lib/time";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle } from "@/components/ui/card";
import { ShiftForm } from "@/components/admin/shift-form";
import { SignupList } from "@/components/volunteer/signup-list";
import { deleteShift, removeSignup, updateShift } from "../actions";

export const metadata: Metadata = { title: "Edit shift" };

const STATUS_TONE = { draft: "neutral", open: "green", closed: "amber" } as const;

export default async function EditShiftPage({ params, searchParams }: PageProps<"/admin/volunteers/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  await requireRole(["organizer", "admin"], `/admin/volunteers/${id}`);
  const shift = await getShiftForAdmin(id);
  if (!shift) notFound();
  const events = await listShiftEventOptions(shift.event_id);
  // An Open shift stays hidden from people while its event is a draft or cancelled.
  const hidden = hiddenByEventLabel(shift);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/admin/volunteers" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
          ← All shifts
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{shift.title}</h1>
          <Badge tone={STATUS_TONE[shift.status]}>{SHIFT_STATUS_LABEL[shift.status]}</Badge>
          {hidden ? <Badge>{hidden}</Badge> : null}
        </div>
        <p className="mt-1 text-muted">
          {formatEventWhen(shift.starts_at, shift.ends_at)}
          {shift.event ? (
            <>
              {" · For "}
              <Link href={`/admin/events/${shift.event.id}`} className="font-semibold text-brand-700 hover:underline">
                {shift.event.title}
              </Link>
            </>
          ) : null}
        </p>
      </div>

      {query.saved ? (
        <Alert tone="success">
          {shift.status === "open"
            ? shift.event?.status === "cancelled"
              ? "Shift created. The event is cancelled, so people can't see this shift."
              : hidden
                ? "Shift created. It shows on the Help out page once the event is published."
                : "Shift created. People can sign up on the Help out page now."
            : shift.status === "draft"
              ? "Shift created as a draft. Set the status to Open when you're ready."
              : "Shift created."}
        </Alert>
      ) : null}

      <Card>
        <CardTitle>
          Signed up ({shift.signups.length} of {shift.slots})
        </CardTitle>
        <div className="mt-3">
          {shift.signups.length === 0 ? (
            <p className="text-sm text-muted">Nobody yet. Share the Help out page in your group chats.</p>
          ) : (
            <SignupList
              shiftId={shift.id}
              signups={shift.signups.map((s) => ({ ...s, when: formatDateTime(s.created_at) }))}
              onRemove={removeSignup}
            />
          )}
        </div>
      </Card>

      <section aria-labelledby="edit-heading" className="space-y-3">
        <h2 id="edit-heading" className="text-lg font-bold text-ink">
          Shift details
        </h2>
        <ShiftForm
          action={updateShift}
          shift={{
            id: shift.id,
            title: shift.title,
            event_id: shift.event_id,
            starts_at: shift.starts_at,
            ends_at: shift.ends_at,
            slots: shift.slots,
            description: shift.description,
            status: shift.status,
          }}
          events={events}
          signupCount={shift.signups.length}
          started={hasStarted(shift.starts_at)}
          onDelete={deleteShift}
        />
      </section>
    </div>
  );
}
