// Role names and permission checks. These mirror the SQL helper functions in
// supabase/migrations (can_manage_events, can_manage_menus, can_view_dietary),
// which are the real enforcement point. The app uses these to decide what to
// show and to fail fast in server actions.
import { SITE } from "@/config/site";

export const ROLES = ["student", "community_guest", "organizer", "kitchen_staff", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  student: "Student",
  community_guest: "Community guest",
  organizer: "Organizer",
  kitchen_staff: "Kitchen staff",
  admin: "Admin",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  student: `Can RSVP, vote on dishes and suggest menu ideas. Given automatically to ${SITE.campus.name} email addresses.`,
  community_guest: "Can RSVP (some events may need organizer approval), vote and suggest.",
  organizer: "Creates events and announcements, manages RSVPs, check-in and menus. Sees allergy counts only, not names.",
  kitchen_staff: "Manages dishes, ingredients and menus, and can view the named dietary report for events.",
  admin: "Everything, including roles, settings, the audit log and the named dietary report.",
};

const has = (roles: readonly Role[], allowed: readonly Role[]) => roles.some((r) => allowed.includes(r));

export const canManageEvents = (roles: readonly Role[]) => has(roles, ["organizer", "admin"]);
export const canManageMenus = (roles: readonly Role[]) => has(roles, ["organizer", "kitchen_staff", "admin"]);
export const canViewDietary = (roles: readonly Role[]) => has(roles, ["kitchen_staff", "admin"]);
export const isStaff = (roles: readonly Role[]) => has(roles, ["organizer", "kitchen_staff", "admin"]);
export const isAdmin = (roles: readonly Role[]) => roles.includes("admin");
