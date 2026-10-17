export const SITE = {
  name: "Chabad at Lehigh",
  shortName: "Chabad Lehigh",
  description:
    "Shabbat dinners, events and community for Lehigh students and friends. RSVP, see menus and allergens, and stay in the loop.",
} as const;

export type NavItem = { href: string; label: string; staffOnly?: boolean };

export const MAIN_NAV: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/my-events", label: "My Events" },
  { href: "/find-us", label: "Find Us" },
];

export const FOOTER_NAV: NavItem[] = [
  { href: "/events", label: "Events" },
  { href: "/announcements", label: "Announcements" },
  { href: "/find-us", label: "Find Us" },
  { href: "/meal-safety", label: "Meals & allergies" },
  { href: "/coming-soon", label: "Coming soon" },
  { href: "/privacy", label: "Privacy" },
];
