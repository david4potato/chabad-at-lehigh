import { NextResponse } from "next/server";
import { viewerWithRole } from "@/lib/auth";
import { getAdminEvent } from "@/lib/data/admin";
import { getAttendees } from "@/lib/data/attendees";
import { GUEST_STATUS_LABEL, MEMBER_LABEL, RSVP_STATUS_LABEL } from "@/lib/rsvp-labels";
import { toDateTimeLocalValue } from "@/lib/time";

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

  // No dietary data here: that stays in the audited dietary report.
  const header = ["Name", "Email", "Phone", "Type", "Status", "Guests", "Guest names", "Guest status", "Checked in", "Note", "RSVP'd at (Bethlehem time)"];
  const rows = attendees.map((a) => [
    a.name, a.email, a.phone, MEMBER_LABEL[a.member], RSVP_STATUS_LABEL[a.status], a.guest_count, a.guest_names,
    a.guest_count > 0 ? GUEST_STATUS_LABEL[a.guest_status] : "",
    a.checked_in_at ? "yes" : "no", a.note, toDateTimeLocalValue(a.created_at).replace("T", " "),
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
