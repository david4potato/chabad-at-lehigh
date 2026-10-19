/**
 * Everything specific to this community lives in this file, plus Dashboard → Settings
 * (contact details, address, directions, parking, student email domains). Another
 * community forks the app, edits this file and its Settings, and has its own version.
 * See docs/REPLICATE.md.
 */
export const SITE = {
  name: "Chabad at Lehigh",
  shortName: "Chabad Lehigh",
  /** Used in calendar feed ids and file names: lowercase letters, numbers and dashes. */
  slug: "chabad-at-lehigh",
  description:
    "Shabbat dinners, events and community for Lehigh students and friends. RSVP, see menus and allergens, and stay in the loop.",
  /** Home page line for visitors who aren't signed in. */
  tagline: "Shabbat dinners, learning and community for Lehigh students and friends. Everyone is welcome.",
  /** Footer line under the name. */
  footerBlurb: "A warm home away from home for Lehigh students and the community. Everyone is welcome.",
  /** Footer note so nobody mistakes the site for the university's own. */
  independenceNote: "An independent organization, not run by Lehigh University.",
  /** Location name pre-filled on new events when an address is set in Settings. */
  houseName: "Chabad House",
  /** Every date and time is shown and entered in this IANA time zone. */
  timeZone: "America/New_York",
  campus: {
    name: "Lehigh",
    /** How the Student role is labelled to people. */
    studentLabel: "Lehigh student",
    /** Used until an admin saves different domains in Settings. */
    studentEmailDomains: ["lehigh.edu"],
  },
} as const;

/** Link-preview image for chats and social posts (public/og-image.png, made by scripts/render-og-image.mjs). */
export const OG_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: `${SITE.name}: Shabbat dinners, events, menus and helping out`,
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
