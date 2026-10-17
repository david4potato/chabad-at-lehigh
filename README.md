# Chabad at Lehigh

A warm, mobile-first hub for Chabad at Lehigh: Shabbat dinner RSVPs, events, menus with
ingredients and allergens, private dietary preferences, and a simple organizer dashboard.

- **Hosting:** Vercel · **Database, sign-in, storage:** Supabase · both free plans, one codebase.
- **Set it up:** [SETUP.md](SETUP.md) — numbered beginner guide with an environment-variable checklist.
- **Before real use:** organizers sign off on [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md).
  Dish votes are never proof that food is safe for someone with an allergy.
- **Organizers:** one-page [docs/ORGANIZER_QUICKSTART.md](docs/ORGANIZER_QUICKSTART.md), plus a built-in guide at
  **Dashboard → Help**. Admins get a **Getting started** checklist (incl. one-click demo removal).

## Features

| Area | What it does |
| --- | --- |
| Sign-in | Email link or 6-digit code, no passwords. `@lehigh.edu` → Student role automatically. |
| Home | Shabbat dinner card with **Going / Not going / Change RSVP**, urgent notices, upcoming events, announcements. |
| Events | List and **Month** views with filters (e.g. Shabbat dinners), **Subscribe** to public events in Google/Apple Calendar, capacity, automatic waitlist, plus-ones, organizer approval, deadlines, **Invite friends**. |
| RSVP | Optional and one tap: **Going / Not going**, change any time; plus-ones, notes and "I can't make it" after the deadline are optional extras. |
| My Events | Upcoming RSVPs, past events with a category filter and "Last time: …". |
| Help out | Sign up to cook, set up or clean up (spots left, one-tap sign up / can't make it); organizers post shifts and see who's coming. |
| Menus | Ingredients and allergens visible before RSVP: **Contains** vs **May contain (cross-contact)** vs **Related** (sesame seeds ↔ oil, wheat ↔ gluten). Kitchen confirmation, versions, urgent updates, disclaimer and organizer contact. Personal allergy alerts — never a "safe" label. |
| Voting | Favorites, votes on proposed dishes, suggestions — all advisory. |
| Profile & settings | **Your activity** (events, Shabbat dinners, times helped, coming since, last time), details, private dietary profile (allergens with severity, diets, notes, consent), notifications, delete dietary info or the whole account. |
| Notifications | In-app bell: waitlist promotions, approvals, invitations, cancelled or changed events, urgent menu changes. |
| Dashboard | **This semester** numbers (events, people, new faces, avg. at Shabbat, volunteer sign-ups), events (duplicate weekly), volunteer shifts, attendees (approvals, guests, cancel for someone, check-in, email, CSV, invitations), menu editor with required preparation confirmation, dishes and ingredients, dietary report, announcements, suggestions, people & roles (with each person's history: events attended, last time, volunteering), settings, audit log, Help. |
| Find Us | Address, directions, map buttons, contact. Pre-filled from public sources — confirm in Settings and add the phone. |

**Planned** (shown at `/coming-soon`): learning sign-ups, photo gallery, opt-in "friends attending",
email/text reminders, QR check-in, customized meals. Tables for learning sign-ups and a gallery bucket already exist.

## How email works

| Email | How | Setup |
| --- | --- | --- |
| Sign-in (link + code) | Supabase sends it through your SMTP sender (Resend or Gmail) | SETUP.md Part B — required |
| Emailing attendees | "Email everyone going" opens *your* email app (BCC); copy emails; CSV | None |
| Invitations | In-app for members; "Copy event link" for everyone else | None |
| Notifications | In-app bell only (no automatic emails yet) | None |

## Roles

| Role | Can |
| --- | --- |
| Student / Community guest | RSVP, vote, suggest, manage own profile and dietary info (some events need approval for community guests). |
| Organizer | Events, RSVPs, check-in, invitations, announcements, menus. **Anonymous** dietary counts only. |
| Kitchen staff | Dishes, ingredients, menus, and the **named** dietary report (every view logged). |
| Admin | Everything, plus roles, settings and the audit log. |

## Security and privacy

- No service-role key anywhere in the app; every query runs as the signed-in person under row level security.
- Passwordless only: the database strips any password, so nobody can pre-register someone else's email.
- Business rules live in SQL so they can't be bypassed: capacity/waitlist (row-locked), approvals, menu
  publishing (confirmation required, published menus frozen), notifications, rate limits (in Postgres).
- Dietary data is owner-only; kitchen staff/admins see it only through an audited report.
- Server-side validation (zod + database checks), safe redirects, security headers.

## Tech and structure

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · Supabase (`@supabase/ssr`) · zod · lucide-react ·
Vitest · pgTAP · Playwright.

```
src/app/              pages and routes (admin/ = dashboard)
src/components/       ui/, layout/, events/, menu/, account/, admin/
src/lib/              auth, Supabase clients, time zone, allergens, menu types
supabase/migrations/  schema, row level security, SQL functions (source of truth)
supabase/setup/       all migrations in one file for the SQL Editor
supabase/scripts/     bootstrap_admin.sql, remove_demo_data.sql
supabase/seed.sql     DEMO data · supabase/templates/ sign-in emails · supabase/tests/ pgTAP
e2e/                  Playwright tests (+ screenshot and link-crawl tools)
```

## Scripts

`npm run dev` · `build` · `lint` · `typecheck` · `test` (unit) · `test:db` (pgTAP) · `test:e2e` (Playwright,
after `build`) · `db:start` / `db:reset` (local Supabase via Docker) · `db:types` · `db:bundle` · `check`.

Local development: see the end of [SETUP.md](SETUP.md). Local sign-in emails appear in Mailpit at
http://127.0.0.1:54324.

## Verified locally (before deployment)

Against a local Supabase stack and a production build: **199** unit tests, **291** database tests,
**56** end-to-end tests (28 journeys × phone and desktop, real email-code sign-in), and a crawl of every
internal link as a visitor and as an admin (no errors). The one-file SQL setup was verified on an empty database. Your
hosted Supabase, Vercel, email sender and domain are verified by the checklist at the end of SETUP.md.

## For maintainers

- `cacheComponents` is off (pages are personalized by the sign-in cookie). A future Next.js major may
  require Cache Components; see `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`.
- Schema changes: add a file in `supabase/migrations/`, then `npm run db:types` and `npm run db:bundle`.
