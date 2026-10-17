import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { EventForm } from "@/components/admin/event-form";
import { createEvent } from "../actions";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireRole(["organizer", "admin"], "/admin/events/new");
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/events" className="text-sm font-semibold text-brand-700 hover:underline">
        ← All events
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">New event</h1>
      <p className="mb-6 text-muted">Start as a draft, then publish when it&apos;s ready. Tip: duplicate last week&apos;s Shabbat dinner instead.</p>
      <EventForm action={createEvent} />
    </div>
  );
}
