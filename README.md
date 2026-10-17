# Chabad at Lehigh

A warm, mobile-first community hub for Chabad at Lehigh: Shabbat dinner RSVPs, events, menus
with ingredients and allergens, private dietary preferences, dish voting, and a simple
organizer dashboard.

- **Hosting:** Vercel (free Hobby plan) · **Database, sign-in, storage:** Supabase (free plan)
- **One codebase**, no paid subscriptions required, no extra services beyond an email sender.
- **New here? Follow [SETUP.md](SETUP.md)** — a numbered, beginner-friendly guide with an
  environment variable checklist.
- **Before real use:** organizers review and approve the workflow and meal/allergy process with
  [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md). Dish votes are never proof that food is
  safe for someone with an allergy.

## What works in this first release

| Area | What people can do |
| --- | --- |
| **Sign-in** | Passwordless: email link *or* 6-digit code (works across devices). Lehigh addresses get the Student role automatically. Short welcome form on first sign-in. |
| **Home** | Prominent Shabbat dinner card with **Going / Not going / Change RSVP**, urgent notices, this week's events, announcements, quick links. |
| **Events & RSVP** | Browse without an account. Event details, capacity and spots left, automatic waitlist (auto-promotion when someone cancels), plus-ones, organizer approval when an event requires it, RSVP deadlines, add-to-calendar (.ics). |
| **My Events** | Upcoming RSVPs with status, change RSVP, past events. |
| **Menus & allergens** | Every dish shows ingredients and allergens **before** you RSVP: *Contains* (from ingredients) vs *May contain / cross-contact* (kitchen-entered) vs *Related* (sesame seeds ↔ sesame oil, wheat ↔ gluten). Kitchen confirmation date, kitchen notes, version history, urgent updates, disclaimer and organizer contact on every menu. Personal alerts based on your saved allergies (never a "safe" label). |
| **Voting & suggestions** | Favorite dishes, vote on proposed menu options (advisory only), suggest dishes/ingredients. |
| **Private dietary profile** | Allergens with severity (sesame seeds and sesame oil listed separately), diets, notes for the kitchen, epinephrine, per-event meal preferences, consent toggle, delete anytime. |
| **Notifications** | In-app bell with unread count: waitlist promotions, approvals, urgent menu changes. |
| **Organizer dashboard** | Events (create, edit, duplicate for next week, cancel), attendees with approvals, guests, waitlist, door check-in, email attendees (BCC), CSV export; menus (drafts, dishes, cross-contact, publish with required preparation confirmation, urgent updates, voting options); dish & ingredient library; dietary report (named for kitchen/admin, anonymous counts for organizers); announcements; suggestions; people & roles; settings; audit log. |
| **Find Us** | Address, directions, parking, one-tap Google/Apple Maps links, contact buttons. |

**Planned (clearly labelled in the app at `/coming-soon`, not built yet):** volunteer sign-ups,
learning program sign-ups, photo gallery, invitations and opt-in "friends attending", email/text
reminders, QR check-in and walk-ins, customized meals and chef integrations. The database already
has tables (with security rules) for volunteer shifts, learning sign-ups and a gallery storage bucket.

## Roles and permissions (least privilege)

| Role | Can do |
| --- | --- |
| Student | RSVP, vote, suggest, manage own profile and dietary info. Given automatically to `@lehigh.edu`. |
| Community guest | Same as student; some events may require organizer approval. |
| Organizer | Events, RSVPs/approvals/check-in, announcements, menus. Sees **anonymous** dietary counts only. |
| Kitchen staff | Dishes, ingredients, menus, and the **named** dietary report (every view is logged). |
| Admin | Everything, including roles, settings and the audit log. |

Enforcement happens in the database (row level security + role-checking SQL functions); the app
also checks roles on every staff page and server action.

## Security and privacy model

- **No service-role key** is used anywhere in the app. The browser and server both use the
  public *publishable* key plus the person's session, so row level security applies to every query.
- RLS is enabled on every table, with explicit, minimal table/column privileges.
- Business rules run in SQL so they can't be bypassed: RSVP capacity/waitlist (row-locked, no
  overselling), approvals, menu publishing (requires preparation confirmation; published menus
  are immutable snapshots; changes need a new version and a change summary), urgent-update
  notifications, rate limits (stored in Postgres — no Redis).
- Dietary data is readable only by its owner. Kitchen staff/admins see it only through an audited
  report function for events people RSVP'd to; organizers get counts without names.
- Inputs are validated with zod on the server and with CHECK constraints in the database.
- Security headers (no framing, no sniffing, strict referrer, HSTS); safe redirects only.

## Tech stack

Next.js 16 (App Router, TypeScript, Server Components & Server Actions) · Tailwind CSS v4 ·
Supabase (`@supabase/ssr`, Auth, Postgres, Storage) · zod · lucide-react icons ·
Vitest (unit) · pgTAP (database) · Playwright (end-to-end).

## Project structure

```
src/app/              pages and routes (admin/ = organizer dashboard)
src/components/       ui/ primitives, layout/ header+nav+footer, events/, menu/, account/, admin/
src/lib/              auth (data access layer), supabase clients, time zone, allergens, menu types
src/proxy.ts          refreshes sessions; redirects signed-out visitors from private pages
supabase/migrations/  database schema, RLS policies and SQL functions (source of truth)
supabase/seed.sql     DEMO data (clearly labelled) for local development / trying the app
supabase/setup/       all migrations in one file for the Supabase SQL Editor
supabase/scripts/     bootstrap_admin.sql, remove_demo_data.sql
supabase/templates/   sign-in email templates (link + code)
supabase/tests/       pgTAP database tests (permissions, RSVP, menus)
e2e/                  Playwright end-to-end tests
docs/                 organizer review checklist
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the app locally on http://localhost:3000 |
| `npm run build` / `npm start` | Production build / serve it |
| `npm run lint` · `npm run typecheck` | ESLint · TypeScript |
| `npm test` | Unit tests (Vitest) |
| `npm run db:start` · `npm run db:reset` | Start local Supabase (Docker) · re-apply migrations + DEMO seed |
| `npm run test:db` | Database security/workflow tests (pgTAP) against local Supabase |
| `npm run test:e2e` | End-to-end tests (Playwright) — run `npm run build` first, local Supabase must be running |
| `npm run db:types` | Regenerate `src/lib/database.types.ts` after schema changes |
| `npm run db:bundle` | Regenerate `supabase/setup/all_migrations.sql` after adding a migration |
| `npm run check` | Lint + typecheck + unit tests + build |

## Local development

See the last section of [SETUP.md](SETUP.md). In short: `npm install`, `npx supabase start`,
`npx supabase db reset`, create `.env.local` from `.env.example` with the local URL/key, then
`npm run dev`. Local sign-in emails appear in Mailpit at http://127.0.0.1:54324.

## Deployment

GitHub → Vercel (automatic deploys on every push to `main`) + Supabase. Step-by-step in
[SETUP.md](SETUP.md), including authentication redirect URLs, email delivery (custom SMTP),
custom domain via Cloudflare DNS, optional Cloudflare Turnstile, and a production verification
checklist. CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit tests, build, database
tests and end-to-end tests on every push and pull request.

## Verification status (local, before deployment)

Tested against a local Supabase stack (Postgres 17, Auth, Storage, Mailpit) with a production build:

- **Unit tests:** 105 passing (time zones incl. daylight-saving changes, allergen matching incl. sesame seed ↔ oil, safe redirects, menu helpers, error messages).
- **Database tests (pgTAP):** 94 passing — dietary privacy, roles, audit log, event visibility, RSVP capacity/waitlist/approvals/guests/deadlines/check-in/rate limits, menu drafts/publishing/immutability/snapshots/urgent notifications, votes and suggestions.
- **End-to-end tests (Playwright):** 24 passing (12 journeys × phone and desktop) using real email-code sign-in.
- The one-file SQL setup (`supabase/setup/all_migrations.sql`) was verified on an empty database, followed by the seed, `bootstrap_admin.sql` and `remove_demo_data.sql`.

Not yet verified: anything on your hosted Supabase project, Vercel, custom SMTP delivery and your domain — those happen during [SETUP.md](SETUP.md), which ends with a production verification checklist.

## Notes for future maintainers

- Next.js 16 runs here with `cacheComponents: false` (classic dynamic rendering) because nearly
  every page is personalized by the sign-in cookie. A future major version may make Cache
  Components mandatory; see `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md`.
- Add schema changes as new files in `supabase/migrations/`, then `npm run db:types` and
  `npm run db:bundle`.
