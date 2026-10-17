import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { listShiftEventOptions } from "@/lib/data/volunteer";
import { ShiftForm } from "@/components/admin/shift-form";
import { createShift } from "../actions";

export const metadata: Metadata = { title: "New shift" };

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewShiftPage({ searchParams }: PageProps<"/admin/volunteers/new">) {
  await requireRole(["organizer", "admin"], "/admin/volunteers/new");
  const params = await searchParams;
  const requested = typeof params.event === "string" && GUID_RE.test(params.event) ? params.event : undefined;
  const events = await listShiftEventOptions(requested);
  // Only preselect an event that is actually in the list.
  const defaultEventId = requested && events.some((e) => e.id === requested) ? requested : undefined;
  const backHref = defaultEventId ? `/admin/events/${defaultEventId}` : "/admin/volunteers";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={backHref} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
        {defaultEventId ? "← Back to the event" : "← All shifts"}
      </Link>
      <h1 className="mb-1 mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">New volunteer shift</h1>
      <p className="mb-6 text-muted">Cooking, setting up, cleaning up: anything you&apos;d like a hand with.</p>
      <ShiftForm action={createShift} events={events} defaultEventId={defaultEventId} />
    </div>
  );
}
