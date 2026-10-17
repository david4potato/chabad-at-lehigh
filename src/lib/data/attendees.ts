import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { isStaff } from "@/lib/roles";

type Enums = Database["public"]["Enums"];

export type Attendee = {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  member: "student" | "staff" | "community";
  status: Enums["rsvp_status"];
  guest_count: number;
  guest_names: string | null;
  guest_status: Enums["guest_status"];
  note: string | null;
  created_at: string;
  status_changed_at: string;
  checked_in_at: string | null;
};

/** All RSVPs for an event with names and student/staff/community labels (organizers/admins via RLS). */
export async function getAttendees(eventId: string): Promise<Attendee[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("rsvps")
    .select(
      "id, user_id, status, guest_count, guest_names, guest_status, note, created_at, status_changed_at, checked_in_at, profile:profiles!rsvps_user_id_fkey(full_name, preferred_name, email, phone, roles:user_roles!user_roles_user_id_fkey(role))",
    )
    .eq("event_id", eventId)
    .order("created_at");
  return (rows ?? []).map((r) => {
    const roles = r.profile?.roles.map((x) => x.role) ?? [];
    return {
      id: r.id,
      user_id: r.user_id,
      name: r.profile?.full_name || r.profile?.preferred_name || r.profile?.email || "Unknown",
      email: r.profile?.email ?? "",
      phone: r.profile?.phone ?? null,
      member: roles.includes("student") ? "student" : isStaff(roles) ? "staff" : "community",
      status: r.status,
      guest_count: r.guest_count,
      guest_names: r.guest_names,
      guest_status: r.guest_status,
      note: r.note,
      created_at: r.created_at,
      status_changed_at: r.status_changed_at,
      checked_in_at: r.checked_in_at,
    };
  });
}
