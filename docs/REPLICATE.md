# Run your own copy

This page is for a volunteer at another campus community who wants to run this app for their own people.
Each copy stands alone: its own code, database, website and sign-in emails. [SCALING.md](SCALING.md)
explains why that is the model for now.

> **There is no license yet.** The repository owner hasn't chosen one, so nothing in this repository gives
> anyone permission to reuse the code. Ask the repository owner for permission before you fork, copy or run it.

## What you get

A mobile-first website where people RSVP to events and Shabbat dinners, see menus with ingredients and
allergens, keep private dietary details, vote on dishes and sign up to help. Organizers get a dashboard for
events, attendees, menus, volunteer shifts, people and roles. Sign-in is an email link or code, with no
passwords. Shabbat dinners and kosher types (meat, dairy, pareve) are built in. The full list is in
[README.md](../README.md).

It runs on free or low-cost plans: Vercel for the website, Supabase for the database and sign-in, GitHub for
the code, and one email sender. The cost table near the top of [SETUP.md](../SETUP.md) shows what each costs.

## Before you start

1. **Your organizers agree to run it.** They decide menus, approvals and capacity. They also review the app
   before anyone uses it (see [Rules that never change](#rules-that-never-change)).
2. **You have permission.** Ask the repository owner first (see the license note above).
3. **Your community owns the accounts.** Create the Supabase, Vercel, GitHub and email accounts with an
   address your community controls. Then the site doesn't depend on one volunteer.
4. **Two admins.** Pick at least two trusted people. Kitchen staff see names next to allergies, so keep that
   group small too.

To try changes on your own computer you need Node.js 20.9+ (22 recommended) and Docker.

## Make your copy

1. Once the owner agrees, fork this repository on GitHub. If you can't see it, ask the owner for access.
2. Clone your fork and run it locally with **[DEMO]** data:

   ```bash
   git clone https://github.com/<you>/<your-fork>.git
   cd <your-fork>
   npm install
   npx supabase start          # local database, sign-in and email
   npx supabase db reset       # tables + [DEMO] data
   cp .env.example .env.local  # paste the local URL + publishable key from `npx supabase status`
   npm run dev                 # http://localhost:3000 — sign-in emails appear at http://127.0.0.1:54324
   ```

3. In your fork on GitHub, open **Actions** and turn workflows on if GitHub asks. CI then checks every pull
   request.
4. Protect `main` as [CONTRIBUTING.md](../CONTRIBUTING.md) describes under "For the owner".

## Edit src/config/site.ts

[src/config/site.ts](../src/config/site.ts) holds the names, campus and time zone the pages use. Contact
details and the address are in **Dashboard → Settings**, and a few files still name the original community (see
[Everything else to change](#everything-else-to-change)). Change every value in `SITE`:

| Field | Where it shows | What to put |
| --- | --- | --- |
| `name` | Header, page titles, link previews, the app name on phones, the welcome page, calendar feeds | Your community's full name. Put the same name in Settings (see below). |
| `shortName` | Under the icon when someone adds the site to a phone's home screen | A shorter form of the name |
| `slug` | Calendar event ids and the calendar file name | Lowercase letters, numbers and dashes. Choose it once, before launch: calendar apps use it to tell events apart, so changing it later can show events twice. |
| `description` | Search results and link previews | One or two sentences about what the site is for |
| `shortDescription` | The app's description when someone installs it on a phone | One shorter sentence |
| `tagline` | Home page, for visitors who aren't signed in | A short welcome line |
| `footerBlurb` | Footer, under the name | One line about your community |
| `independenceNote` | Footer | Who you are independent of, such as the nearby university |
| `houseName` | Place name on new events: pre-filled once Settings has an address, and the placeholder otherwise | What people call your usual place |
| `adminExample` | Admin launch checklist: "Give admin access to at least one more trusted person (e.g. …)" | Who should be the second admin. Only admins see it. |
| `timeZone` | Every date and time, shown and entered | Your IANA time zone, such as `America/Chicago` or `Europe/London`. If it isn't `America/New_York`, read [Time zone](#time-zone) below. |
| `timeZoneLabel` | Form hints and Help | How people say it, such as "Chicago, IL time" |
| `timeZoneShortLabel` | The time column heading in the attendee spreadsheet | A shorter form, such as "Chicago time" |
| `campus.name` | Sign-in hint, role descriptions, an approval hint on the event form, Help | Your campus's short name |
| `campus.studentLabel` | The Student choice on profiles and in People & roles | How students would describe themselves |
| `campus.studentEmailDomains` | Sign-in hint, email placeholders and the Settings error example (the first domain) | Your campus email domains, without `@`. Keep them the same as in Settings, which decides who becomes a Student. |

Below `SITE`, `OG_IMAGE.alt` is the link-preview image's alt text. It uses `name` plus a fixed line; change the
line if your image says something else. Leave `MAIN_NAV` and `FOOTER_NAV` as they are.

Then run `npm run lint`, `npm run typecheck` and `npm test`. See [Tests](#tests) for what the tests expect.

Two things to know:

- **The name lives in two places.** The footer and Find Us use **Organization name** from Settings. Everything
  else uses `SITE.name`. If they differ, both names appear.
- **No student email domain?** `studentEmailDomains` needs at least one entry. The sign-in hint reads the first
  one, and an empty list fails `npm run typecheck`. Without a domain, nobody becomes a Student automatically. The
  approval mode "Guests and community members need approval" then confirms only staff and anyone an admin gives
  Student in **People & roles**. Everyone else waits for approval. Its hint still says students are confirmed
  automatically. Change that hint in `src/components/admin/event-form.tsx`, and the sign-in hint in
  `src/app/sign-in/sign-in-form.tsx`, before launch.

## Everything else to change

**Must** means your copy is wrong or broken without it. **Should** means it still names the original community.
**Optional** is branding.

### In Dashboard → Settings, after you sign in

Load the database as it is (SETUP step 2). Then change these values in **Dashboard → Settings** after your first
sign-in. That is simpler than editing the migrations, and it keeps later updates from this repository easy to merge.

| Setting | What it starts as |
| --- | --- |
| Organization name, contact name, contact email, contact phone | The original community's details (the phone starts blank) |
| Address, map search text, directions, parking | The original community's address, directions and parking |
| Student email domains | The original campus's domain |

All of these are **must**:

- Until an admin saves Settings, Find Us, the footer and the allergy contact next to every menu show the original
  community's details. Replace every field before you share the site's address.
- Add a phone number. It is shown as the allergy contact.
- Save the student domains before anyone else signs in. People get Student or Community guest at their first
  sign-in, and changing the domains later doesn't change existing accounts.

Saving Settings ticks "Check the contact details and parking" in the **Getting started** checklist.

### Files

| What | File | Action | How |
| --- | --- | --- | --- |
| Link-preview image | `public/og-image.png`, made by `scripts/render-og-image.mjs` | Must | The name and tagline are typed into the script, not read from `site.ts`. Edit them, run `npx playwright install chromium` once, then `node scripts/render-og-image.mjs`. |
| Sign-in email headings | `supabase/templates/magic_link.html`, `supabase/templates/confirmation.html` | Must | The first line names the original community. Edit it, then paste each file into Supabase (SETUP step 7). Your hosted project doesn't read these files. |
| Code owner | `.github/CODEOWNERS` | Must | It names the original owner. Put your GitHub username there. |
| Time zone in notifications | Two database functions | Must, if your zone isn't `America/New_York` | See [Time zone](#time-zone). |
| Tests | Unit, database and end-to-end tests | Must, if you change the values they check | See [Tests](#tests). |
| Guides | `SETUP.md`, `README.md`, `CONTRIBUTING.md`, `docs/ORGANIZER_QUICKSTART.md`, `docs/ORGANIZER_REVIEW.md`, `docs/PHILOSOPHY.md` | Should | They name the original community, its campus or its people. Change the names and keep the rules. The quick start has the note you send new admins. |
| Claude Code guide | `CLAUDE.md` | Should | Change the title and the time zone in the Times line, so Claude sessions use your zone. |
| One-page summary | `docs/one-pager/one-pager.html` | Should | Name, launch status and address. Then `node docs/one-pager/render.mjs` (set `SITE_URL` to fill in the site address). |
| Demo data | `supabase/seed.sql` | Should, if you use it | Demo events and announcements use the original community's name, address and time zone. `npx supabase db reset` loads it locally. |
| Local Supabase settings | `supabase/config.toml` | Should | `project_id` (change it if two copies run on one computer) and the two email subjects. Local only. |
| First-admin script | `supabase/scripts/bootstrap_admin.sql` | Optional | The placeholder email has a campus domain. You replace it with your own email anyway. |
| Colors | `src/app/globals.css`, `#fffaf2` in `src/app/manifest.ts` and `src/app/layout.tsx`, inline colors in the email templates and `scripts/render-og-image.mjs` | Optional | The comment in `globals.css` says every text color meets WCAG AA. Check contrast again if you change them. |
| Icons | `public/icon-192.png`, `public/icon-512.png`, `src/app/icon.svg`, `src/app/apple-icon.png`, `src/app/favicon.ico`, `docs/one-pager/icon.png` | Optional | A flame on blue, no text. Only `icon.svg` can be edited as text; the others need an image editor. The preview image uses `icon-512.png`. |
| Names | `package.json`, `package-lock.json`, `.env.example`, `scripts/bundle-sql.mjs` | Optional | The package name, comments and the header line of the SQL bundle. |

Leave `vercel.json` (a daily keep-alive that works in any zone), `.github/workflows/ci.yml`, `.claude/`,
`AGENTS.md` and `next.config.ts` as they are. Never edit `supabase/setup/all_migrations.sql` by hand: run
`npm run db:bundle` after any migration change.

### Time zone

`SITE.timeZone` covers every page. Two database functions don't read it. They write the time into in-app
notifications, using `America/New_York` and a 12-hour clock:

- `private.after_event_update` in `supabase/migrations/20261017000200_events_rsvps.sql` (cancelled, changed or
  reinstated events)
- `private.notify_shift_change` in `supabase/migrations/20261017000900_volunteering_and_stats.sql` (changed
  volunteer shifts)

If your zone is different:

1. Add a file to `supabase/migrations/` whose name starts with a later 14-digit timestamp than the others.
2. Copy both `create or replace function` blocks into it. Change the time zone, and the `to_char` format if
   you want a 24-hour clock.
3. Run `npm run db:bundle`, so `supabase/setup/all_migrations.sql` includes the new file. If your database is
   already loaded, run just the new file in the SQL Editor.
4. When you pull updates later, search new migrations for `America/New_York`. A later migration that replaces
   either function brings the old zone back.

### Outside the United States

These need code changes, not settings:

| What | Where | Why it matters |
| --- | --- | --- |
| Zones at UTC+12 or later, such as New Zealand | `formatDayKey` in `src/lib/time.ts` | It labels a day from noon UTC, which is already the next day there. Day headings on the Events page, and the day names screen readers hear in the month view, name the next day. |
| Semesters start August 1 and January 1 | `semesterStart` in `src/lib/stats.ts`, and the text in `src/app/admin/help/page.tsx` | The "This semester" numbers on Overview count from those dates. |
| US English, 12-hour clock, month-first dates | `"en-US"` in `src/lib/time.ts`, `src/components/events/event-utils.ts` and `src/app/page.tsx`; `"en_US"` in `src/app/layout.tsx` | How every date and time reads |
| English day and month names, 12-hour clock in notifications | `to_char` in the two functions under [Time zone](#time-zone) | How cancelled, changed and shift notifications read |
| US Letter paper | `docs/one-pager/` | The printed summary only |

### Tests

CI runs the unit, database and end-to-end tests. They are written so that editing `site.ts` doesn't break them:

- **Unit tests** check the time and calendar logic against the original slug and time zone. `src/test-setup.ts`
  pins those two values for every unit test, so they pass whatever `site.ts` says. Leave that file as it is.
- **End-to-end tests** read the name, labels and time zone from `site.ts`, and the student domain from the local
  database.
- **Database tests** (all of `supabase/tests/*.sql`) sign up at the original campus domain to get Student
  accounts. They pass as long as the migrations keep that domain as the starting value, which they do when you
  change domains in Settings. If you edit the domain in the migration instead, change it in those files too.
  `e2e/screenshots.mjs`, which takes optional screenshots, uses it as well.

## Set it up

Follow [SETUP.md](../SETUP.md) with your own Supabase project, Vercel project and email sender. It was written
for the original community, so some steps name it. Use your own values there:

| SETUP step | It says | Use instead |
| --- | --- | --- |
| Fastest path 1, step 1 | The original project name and a region near it | Your `slug`, and the region nearest you |
| Fastest path 1, steps 12–13 | The original organizers as admins | Your two admins |
| Fastest path 2, step 14 | Create a GitHub repository and push | Skip it: your fork is already there |
| Fastest path 3, steps 15–16 | Import the original repository | Import your fork |
| Step 2 | Paste `supabase/setup/all_migrations.sql` | The same file. If you added a time zone migration, run `npm run db:bundle` first. |
| Step 3 | Optional demo data | Skip it on your hosted project, unless you edited `supabase/seed.sql` |
| Step 7 | Email subjects with the original name | The same subjects with your name. Bodies from your edited templates. |
| Steps 9–10 | The original sender domain, address and name | A subdomain of your own website, your sender address and your community's name |
| Step 12 | The placeholder email in `bootstrap_admin.sql` | Your own email. Any address works. |
| Fastest path 5, step 24 | Confirm the pre-filled contact details and add the phone | Replace every field with your own, then **Save settings** |
| Fastest path 6 | Send the organizer quick start | Your edited `docs/ORGANIZER_QUICKSTART.md` |
| Part F, steps 19–20 | The original community's website domain | A subdomain of your own website. The same warning applies: don't change your domain's nameservers or its main, www or MX records. |
| Troubleshooting | Give Student to people with an address at the original campus | Your campus's domains |

## Rules that never change

Your copy can change names, colors and wording. It can't weaken these. They come from
[PHILOSOPHY.md](PHILOSOPHY.md) and the meal and allergy rules in `CLAUDE.md`.

- Never call food "safe", "allergen-free", "free of" an allergen or "guaranteed". Votes and ingredient lists are
  never evidence of safety.
- **Contains**, **May contain** and **Related** stay separate.
- Votes and suggestions are advice. Staff confirm how food is prepared before a menu is published.
- Every menu shows the meal disclaimer and how to reach the organizer.
- Dietary details are private. Only the person sees them, plus kitchen staff and admins through an audited report.
  Organizers see counts, not names.
- Anyone can delete their dietary details or their whole account at any time.
- Admins grant roles; nobody picks their own. Every permission is checked on the server and in the database.
- The app never uses Supabase's secret (service-role) key.
- Sample content is labeled **[DEMO]**. Contact details show only what you've confirmed.

Before you announce the site:

1. Your organizers and whoever cooks go through [ORGANIZER_REVIEW.md](ORGANIZER_REVIEW.md) and sign it off.
2. Hold one trial meal: create an event, publish its menu, take RSVPs and check people in.
3. Read `/privacy` and `/meal-safety` on your site. They must match how your community really handles
   information and food.

## Getting updates later

Add this repository as a second remote, once:

```bash
git remote add upstream <this repository's URL>
```

Then, for each update:

1. `git fetch upstream`, make a branch from your `main`, and `git merge upstream/main` into it.
2. Fix any conflicts. They usually come from files you changed, such as `src/config/site.ts` and the guides. Keep
   your values and take the new lines.
3. If you added your own migration, run `npm run db:bundle` again so the bundle has both. If
   `supabase/setup/all_migrations.sql` conflicts, take either side, then re-run it.
4. Run `npm run check` (lint, typecheck, unit tests, build). Open a pull request into your `main`; CI runs the rest.
5. A merge to `main` updates your live site, so run only the new files from `supabase/migrations/` in the SQL
   Editor, in order, as you merge.
   "Later database changes" at the end of [SETUP.md](../SETUP.md) shows the CLI way.

GitHub's **Sync fork** button does the same merge straight into `main`, before CI has checked it. A branch and a
pull request are safer.

After launch, your own database changes are new migration files too. Never edit a migration that has already
run on your live database. Then run `npm run db:types` and `npm run db:bundle`.

## One shared site for many communities

If several communities want the app, one shared site could replace separate copies. That is a large change to
the database. [SCALING.md](SCALING.md) compares the two models and says when the change is worth it.
