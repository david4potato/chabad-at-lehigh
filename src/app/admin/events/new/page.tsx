import type { Metadata } from "next";
import Link from "next/link";
import { SITE } from "@/config/site";
import { requireRole } from "@/lib/auth";
import { getOrgSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { formatShortDateMaybeYear } from "@/lib/time";
import { EventForm } from "@/components/admin/event-form";
import { createEvent } from "../actions";

export const metadata: Metadata = { title: "New event" };

export default async function NewEventPage() {
  await requireRole(["organizer", "admin"], "/admin/events/new");
  const supabase = await createClient();
  const [org, { data: lastDinner }] = await Promise.all([
    getOrgSettings(),
    // The most recent Shabbat dinner that has started: the one to copy for next week.
    supabase
      .from("events")
      .select("id, starts_at")
      .eq("category", "shabbat_dinner")
      .eq("status", "published")
      // Never a demo dinner: its copy would be marked demo too and removed with the demo content.
      .eq("is_demo", false)
      .lte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
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
      <Link href="/admin/events" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
        ← All events
      </Link>
      <h1 className="text-3xl mb-1 mt-2 font-extrabold tracking-tight lg:text-[2.5rem] lg:leading-tight">New event</h1>
      <p className="text-muted">Start as a draft, then publish when it&apos;s ready.</p>
      {lastDinner ? (
        <p className="mb-6 text-muted">
          Planning a Shabbat dinner? Open{" "}
          <Link
            href={`/admin/events/${lastDinner.id}`}
            className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline"
          >
            the last one ({formatShortDateMaybeYear(lastDinner.starts_at)})
          </Link>{" "}
          and press <strong>Duplicate for next week</strong> near the top.
        </p>
      ) : (
        <p className="mb-6 text-muted">
          After your first Shabbat dinner, you can copy it each week with <strong>Duplicate for next week</strong> on its page.
        </p>
      )}
      <EventForm
        action={createEvent}
        defaults={{ location_name: addr ? SITE.houseName : "", location_address: addr }}
      />
    </div>
  );
}
