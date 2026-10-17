import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { EventForm } from "@/components/admin/event-form";
import { createEvent } from "../actions";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireRole(["organizer", "admin"], "/admin/events/new");
  const org = await getOrgSettings();
  // Same fallback as Find Us: map search text if set, else the last lines of the address.
  const addr =
    org.map_query.trim() ||
    org.address
      .trim()
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(-2)
      .join(", ");
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/events" className="text-sm font-semibold text-brand-700 hover:underline">
        ← All events
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">New event</h1>
      <p className="mb-6 text-muted">Start as a draft, then publish when it&apos;s ready. Tip: duplicate last week&apos;s Shabbat dinner instead.</p>
      <EventForm
        action={createEvent}
        defaults={{ location_name: addr ? "Chabad House" : "", location_address: addr }}
      />
    </div>
  );
}
