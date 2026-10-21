# Audit notes

What has been checked, how to run every check again, and what is known not to be covered. Last updated
21 October 2026, evening. Read this before auditing; GO_LIVE.md has the setup steps.

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

## Run every check

From the repository root, with Node 22 and Docker running:

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
- **Admin record pages have generic browser-tab titles** (for example "Edit event · Dashboard").

## Not tested

- The hosted Supabase project, the Vercel environment variables and real email delivery. Claude's Supabase
  connector can't see the project, and local tests use Mailpit. GO_LIVE.md "How to check it worked" covers these
  after setup.
- Real phones (iOS Safari, Android Chrome). Tests use Chromium's phone emulation.
- Screen readers. Coverage is axe plus keyboard checks, not VoiceOver, TalkBack or NVDA.
- Printing the dietary report.
- Time zones other than `America/New_York`, languages other than English, and the optional bot check (Turnstile)
  end to end.
