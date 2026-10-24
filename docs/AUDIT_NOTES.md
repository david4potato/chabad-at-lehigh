# Audit notes

What has been checked, how to run every check again, and what is known not to be covered. Last updated
23 October 2026. Read this before auditing; GO_LIVE.md has the setup steps.

## Done

| When | What | Result |
| --- | --- | --- |
| 19 Oct | Every dashboard page as admin, organizer, kitchen staff and student | About 30 fixes, merged |
| 19 Oct | Database speed on synthetic data (5,000 people, three years of events) | Six indexes, numbers in [SCALING.md](SCALING.md) |
| 20 Oct | Layout on phone and laptop, links and metadata, content and privacy | About 20 fixes, merged |
| 20 Oct | Shared mobile and spacing standard ([shared/MOBILE_AND_SPACING.md](shared/MOBILE_AND_SPACING.md)) | All clear on every public page at 5 widths |
| 20 Oct | Accessibility: axe on every page and role at 375 and 1280 px, keyboard walk-through, source review | 11 fixes, merged |
| 21 Oct | Privacy: every table, RPC and page as anon, student, guest, organizer, kitchen staff and admin | One fix: organizers' dietary counts stay hidden until 5 people share |
| 21 Oct | Links, downloads (.ics, CSV), special files, secrets in tracked files and git history | Clean |
| 21 Oct | Ready for contributors: README quick start, CONTRIBUTING (branch, draft pull request, owner merges), CODEOWNERS, `.env.example` names only, session-start hook, `.claude/settings.json` guardrails (no `.env` reads, deploys, force pushes or live-database pushes) | Done. Secret scanning and branch protection are the owner's clicks (GO_LIVE.md, "GitHub settings") |
| 21 Oct | Efficiency: page weight, packages, polling, database queries, build warnings | One fix: the public calendar feed is cached for 15 minutes, so calendar apps' polls don't reach the database. Home page about 17 KB of HTML plus 195 KB of compressed scripts and styles; no images, web fonts or trackers |
| 21 Oct | Final look by eye at 375 and 1280 px (home, events, an event, help out, find us, sign-in; as a student: an event with allergies, My Events, dietary form; as admin: dashboard, event editor, dietary report), then the shared mobile check | Nothing to fix. All clear on 16 public pages at 5 widths |
| 22 Oct | Typography and spacing on all 32 pages at 320 to 1920 px: centering, line length, line height, heading sizes, phone gutters, card rows; then by eye at 375 and 1440 px | Content was already centered at every width. Fixed: text lines reached 158 characters on wide screens, now about 80 (one base rule); three dashboard alignments (attendee tiles, ingredient rows, shift counts) |
| 22 Oct | Ready to share: contributor files, guardrails, private data in tracked files | Added good first tasks and a session hook that installs packages on a fresh clone. No keys, real people's details, drafts or real dietary data in tracked files |
| 22 Oct | Plain wording on every text-heavy screen, with an adversarial review per screen group | Shorter text, paragraphs of 3 sentences at most, alerts at 16 px; every rule and privacy line kept |
| 23 Oct | Printed Dietary report (Chromium PDF, Letter, grayscale and a 36-person copy) | Every page now says confidential, names the dinner date and has page numbers; severe allergies and epinephrine stand out in black and white and are listed first; the "By person" heading stays with its list; the tab title (and PDF file name) includes the date |
| 23 Oct | Screen-reader pass on sign-in, RSVP and the dietary form (accessibility tree and focus after every action, 375 and 1280 px) | Focus now lands on the new RSVP status, the sign-in field with the error, and a sensible place after deleting dietary information; ingredient allergens say "Contains"; menu headings in order |
| 23 Oct | Fresh clone, following README and CONTRIBUTING word for word | Node 22.12 or newer stated everywhere; quick start runs the checks before the dev server; how to become admin locally; no stale test counts |
| 23 Oct | Dashboard browser tabs | Event, dish and shift pages name the record (person pages don't, so names stay out of browser history) |

## Run every check

From the repository root, with Node 22.12 or newer and Docker running:

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run build

# Local database: start, load migrations and demo data, run the SQL tests
SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io npx supabase start -x studio,edge-runtime,logflare,vector,realtime,imgproxy,postgres-meta,supavisor
npx supabase db reset
npm run test:db

# The setup SQL must match the migrations (no output means it matches)
npm run db:bundle && git diff --exit-code supabase/setup/all_migrations.sql

# End-to-end tests on a phone and a laptop (starts the built app on port 3100)
npm run test:e2e

# With the built app running (npx next start -p 3100):
node e2e/crawl.mjs http://localhost:3100            # every internal link, as visitor and admin
node docs/shared/mobile-check.mjs http://localhost:3100 / /events "/events?view=month" /announcements \
  /find-us /meal-safety /privacy /coming-soon /sign-in /volunteer /events/<each published slug>
```

In a cloud sandbox, set `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` for the end-to-end tests and the scripts.
Get the demo event slugs from the local database (`select slug from events where status = 'published'`).

## Known gaps, kept on purpose

- **Missing pages answer HTTP 200.** The root `src/app/loading.tsx` streams a loading screen, so `notFound()` and
  role redirects reach the browser after the status is sent. People still see the not-found page or get sent to
  sign-in. It's kept for instant feedback on slow phones, and every page is noindex until launch.
- **Dietary counts and differencing.** Organizers see no breakdown until 5 people share. Past that, someone who
  compares the counts before and after one RSVP could still guess one person's allergy. Kitchen staff and admins see
  names anyway; organizers are trusted staff.

## Not tested

- The hosted Supabase project, the Vercel environment variables and real email delivery. Claude's Supabase
  connector can't see the project, and local tests use Mailpit. GO_LIVE.md "How to check it worked" covers these
  after setup.
- Real phones (iOS Safari, Android Chrome). Tests use Chromium's phone emulation.
- Real screen readers (VoiceOver, TalkBack, NVDA). Coverage is axe, keyboard checks and an accessibility-tree pass.
- Printing on a real printer, and in Safari or Firefox (page headers and numbers use Chromium's `@page` boxes;
  other browsers still print the report, with their own header and footer).
- Time zones other than `America/New_York`, languages other than English, and the optional bot check (Turnstile)
  end to end.
