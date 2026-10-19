/**
 * The names, campus and time zone the pages use. The rest of what's specific to this community
 * is in Dashboard → Settings (organization name, contact details, address, directions, parking,
 * student email domains) and a few files listed in docs/REPLICATE.md.
 */
export const SITE = {
  name: "Chabad at Lehigh",
  shortName: "Chabad Lehigh",
  /** Used in calendar feed ids and file names: lowercase letters, numbers and dashes. */
  slug: "chabad-at-lehigh",
  description:
    "Shabbat dinners, events and community for Lehigh students and friends. RSVP, see menus and allergens, and stay in the loop.",
  /** Shorter description for the app installed on a phone (the manifest). */
  shortDescription: "Shabbat dinners, events and community for Lehigh students and friends.",
  /** Home page line for visitors who aren't signed in. */
  tagline: "Shabbat dinners, learning and community for Lehigh students and friends. Everyone is welcome.",
  /** Footer line under the name. */
  footerBlurb: "A warm home away from home for Lehigh students and the community. Everyone is welcome.",
  /** Footer note so nobody mistakes the site for the university's own. */
  independenceNote: "An independent organization, not run by Lehigh University.",
  /** Location name pre-filled on new events when an address is set in Settings. */
  houseName: "Chabad House",
  /** Named in the admin launch checklist as someone to give admin access to. */
  adminExample: "the Greenbergs",
  /**
   * Every date and time is shown and entered in this IANA time zone. Two SQL notification
   * functions repeat it (see docs/REPLICATE.md).
   */
  timeZone: "America/New_York",
  /** How that time zone is named in form hints and Help. */
  timeZoneLabel: "Bethlehem, PA time",
  /** Shorter form for the attendee spreadsheet's column heading. */
  timeZoneShortLabel: "Bethlehem time",
  campus: {
    name: "Lehigh",
    /** How the Student role is labelled to people. */
    studentLabel: "Lehigh student",
    /**
     * The first one is the example in sign-in hints and email placeholders. Who becomes a Student
     * is decided by the domains in Dashboard → Settings, so keep them the same.
     */
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
