import type { Database } from "@/lib/database.types";

type Enums = Database["public"]["Enums"];

/** The words organizers see for RSVP states (attendee list and CSV export). */
export const RSVP_STATUS_LABEL: Record<Enums["rsvp_status"], string> = {
  going: "Going",
  waitlist: "Waitlist",
  pending: "Needs approval",
  not_going: "Not going",
  // An organizer turned the request down; "Declined" alone reads like the guest said no.
  declined: "Request declined",
};

export const GUEST_STATUS_LABEL: Record<Enums["guest_status"], string> = {
  none: "",
  pending: "Needs approval",
  approved: "Approved",
  declined: "Declined",
};

export const MEMBER_LABEL = { student: "Student", staff: "Staff", community: "Community" } as const;
