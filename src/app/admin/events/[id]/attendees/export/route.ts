import { NextResponse } from "next/server";
import { viewerWithRole } from "@/lib/auth";
import { getAdminEvent } from "@/lib/data/admin";
import { getAttendees } from "@/lib/data/attendees";

// Spreadsheet-safe CSV cell (also blocks formula injection like "=HYPERLINK(...)").
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(_request: Request, ctx: RouteContext<"/admin/events/[id]/attendees/export">) {
  if (!(await viewerWithRole(["organizer", "admin"]))) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await ctx.params;
  const event = await getAdminEvent(id);
  const attendees = await getAttendees(event.id);

  const header = ["Name", "Email", "Phone", "Type", "Status", "Guests", "Guest names", "Guest status", "Checked in", "Note", "RSVP'd at"];
  const rows = attendees.map((a) => [
    a.name, a.email, a.phone, a.member, a.status, a.guest_count, a.guest_names, a.guest_status,
    a.checked_in_at ? "yes" : "no", a.note, a.created_at,
  ]);
  const csv = [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

  return new NextResponse("﻿" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="attendees-${event.slug}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
