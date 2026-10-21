import { NextResponse } from "next/server";
import { SITE } from "@/config/site";
import { buildCalendarFeed } from "@/lib/calendar";
import { listCalendarFeedEvents, type FeedEventRow } from "@/lib/data/events";
import { getSiteUrl } from "@/lib/env";

// Subscribable calendar of public events (Google Calendar, Apple Calendar,
// Outlook). Calendar apps poll this URL; the same feed is served to everyone.
export async function GET() {
  let events: FeedEventRow[];
  try {
    events = await listCalendarFeedEvents();
  } catch {
    // Never answer a database error with an empty calendar: apps would delete
    // every event. A 503 makes them keep their last good copy and retry later.
    return new NextResponse("Calendar temporarily unavailable. Please try again soon.", {
      status: 503,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "Retry-After": "300",
      },
    });
  }

  const body = buildCalendarFeed(events, {
    siteUrl: getSiteUrl(),
    name: SITE.name,
    description: `Shabbat dinners, learning, holidays and more at ${SITE.name}.`,
  });

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${SITE.slug}.ics"`,
      // The feed is the same for everyone, so Vercel's cache can answer calendar apps' polls for 15 minutes.
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
