import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];

export type Attendee = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  member: "student" | "community";
  status: Enums["rsvp_status"];
  guest_count: number;
  guest_names: string | null;
  guest_status: Enums["guest_status"];
  note: string | null;
  created_at: string;
  status_changed_at: string;
  checked_in_at: string | null;
};

/** All RSVPs for an event with names and student/community labels (organizers/admins via RLS). */
export async function getAttendees(eventId: string): Promise<Attendee[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("rsvps")
    .select(
      "id, user_id, status, guest_count, guest_names, guest_status, note, created_at, status_changed_at, checked_in_at, profile:profiles!rsvps_user_id_fkey(full_name, preferred_name, email, phone)",
    )
    .eq("event_id", eventId)
    .order("created_at");
  const list = rows ?? [];
  const ids = [...new Set(list.map((r) => r.user_id))];
  const { data: roles } = ids.length
    ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
    : { data: [] as { user_id: string; role: string }[] };
  const students = new Set((roles ?? []).filter((r) => r.role !== "community_guest").map((r) => r.user_id));

  return list.map((r) => ({
    id: r.id,
    user_id: r.user_id,
    name: r.profile?.full_name || r.profile?.preferred_name || r.profile?.email || "Unknown",
    email: r.profile?.email ?? "",
    phone: r.profile?.phone ?? null,
    member: students.has(r.user_id) ? "student" : "community",
    status: r.status,
    guest_count: r.guest_count,
    guest_names: r.guest_names,
    guest_status: r.guest_status,
    note: r.note,
    created_at: r.created_at,
    status_changed_at: r.status_changed_at,
    checked_in_at: r.checked_in_at,
  }));
}
