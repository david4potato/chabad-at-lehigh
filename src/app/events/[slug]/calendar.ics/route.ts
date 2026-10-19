import { NextResponse } from "next/server";
import { SITE } from "@/config/site";
import { getEventBySlug } from "@/lib/data/events";
import { getSiteUrl } from "@/lib/env";
import { icsEscape, icsFold, icsStamp } from "@/lib/ics";

export async function GET(_request: Request, ctx: RouteContext<"/events/[slug]/calendar.ics">) {
  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event || event.status !== "published") return new NextResponse("Not found", { status: 404 });

  const start = new Date(event.starts_at);
  const end = event.ends_at ? new Date(event.ends_at) : new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const url = `${getSiteUrl()}/events/${event.slug}`;
  const location = [event.location_name, event.location_address].filter(Boolean).join(", ");
  const description = [event.summary, url].filter(Boolean).join("\n\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${SITE.name}//Events//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@${SITE.slug}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(event.title)}`,
    ...(location ? [`LOCATION:${icsEscape(location)}`] : []),
    `DESCRIPTION:${icsEscape(description)}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new NextResponse(lines.map(icsFold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${event.slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
