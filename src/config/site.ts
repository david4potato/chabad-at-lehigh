export const SITE = {
  name: "Chabad at Lehigh",
  shortName: "Chabad Lehigh",
  description:
    "Shabbat dinners, events and community for Lehigh students and friends. RSVP, see menus and allergens, and stay in the loop.",
} as const;

/** Link-preview image for chats and social posts (public/og-image.png, made by scripts/render-og-image.mjs). */
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "Chabad at Lehigh: Shabbat dinners, events, menus and helping out",
};

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
  { href: "/volunteer", label: "Help out" },
  { href: "/find-us", label: "Find Us" },
  { href: "/meal-safety", label: "Meals & allergies" },
  { href: "/coming-soon", label: "Coming soon" },
  { href: "/privacy", label: "Privacy" },
];
