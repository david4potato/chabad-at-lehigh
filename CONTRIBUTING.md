# Helping with Chabad at Lehigh

Thank you for helping. The app serves real students, including people with serious food allergies, so a few
rules matter more than speed.

## Getting access

The owner invites you as a collaborator (GitHub → Settings → Collaborators). That lets you push branches and
open pull requests. Before inviting anyone, the owner protects `main`, so changes reach it only through a pull
request that passes CI and that the owner approves. You don't need Supabase, Vercel or email accounts: you work on your own computer against a
local copy of the database with **[DEMO]** data.

## Run it

Needs Node.js 22.12 or newer, and Docker running.

```bash
npm install
npx supabase start          # local database, sign-in and email
npx supabase db reset       # tables + [DEMO] data
cp .env.example .env.local  # paste the local URL + publishable key from `npx supabase status`
npm run dev                 # http://localhost:3000 — sign-in emails appear at http://127.0.0.1:54324
```

**The dashboard locally.** Sign in once, then open Supabase Studio at http://127.0.0.1:54323 → **SQL Editor**,
paste `supabase/scripts/bootstrap_admin.sql` with the email you signed in with, and press **Run**. Refresh the
app and you're an admin. Run it again after `npx supabase db reset`. The demo data has events and dishes but no
people: RSVP and fill in **Dietary & allergies** yourself, with made-up details.

## Make a change

1. Branch from `main`. One change per pull request. Never push to `main` directly.
2. Before you push: `npm run lint`, `npm run typecheck`, `npm test`. Database changes: `npm run test:db`.
   Screens: `npx playwright install chromium` (once), `npm run build`, then `npm run test:e2e`.
3. Open a draft pull request into `main`. CI runs every check. Mark it ready when it's done; the owner reviews
   and merges. A merge to `main` updates the live site.

## Good first tasks

Small, useful, and none of them touch allergy logic. Pick one, say so in a draft pull request, and ask if
anything is unclear. They come from the known gaps in [docs/AUDIT_NOTES.md](docs/AUDIT_NOTES.md).

1. **Try the quick start from a fresh clone.** Follow [README.md](README.md), "Quick start", word for word on your
   own computer. Fix any step that didn't work for you, in the README itself.
2. **Add a print test.** The Dietary report's print layout was checked by hand on 23 October. Add an end-to-end
   test in `e2e/` that RSVPs a test person with an allergy (see `e2e/helpers.ts`), opens that event's **Dietary**
   tab as an admin, switches to print (`page.emulateMedia({ media: "print" })`), and checks that the site header,
   tabs and Print button are hidden and the confidential line shows. Done when `npm run test:e2e` passes.
3. **Screen reader pass.** With VoiceOver, TalkBack or NVDA, sign in, RSVP to the demo Shabbat dinner and fill in
   **Dietary & allergies**. List anything confusing or unannounced in the pull request, and fix the labels you
   can. An automated check of the same flows was done on 23 October; a real screen reader hasn't been tried.

## Rules that never bend

The full list is [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md). The ones people trip over:

- Never call food "safe", "allergen-free" or "guaranteed". Keep **Contains**, **May contain** and **Related**
  separate. Votes are advice, never safety information.
- Dietary information stays private. Organizers see counts, not names.
- Every permission is checked on the server and in the database (row level security).
- No secrets in code. Keys live in environment variables, and the app never uses Supabase's secret
  (service-role) key.
- Business rules live in SQL (`supabase/migrations/`). Schema changes are new migration files; never edit one
  that has run on the live database. Then `npm run db:types` and `npm run db:bundle`.
- Don't deploy, change the live database or force-push. The owner does those.

## Using Claude Code

- `CLAUDE.md` loads automatically, so Claude follows the project rules.
- `.claude/settings.json` is shared. It's a seatbelt for Claude, not a lock: Claude won't open `.env` files with
  its file tools or commands like `cat`, won't run the Vercel CLI or force-push in the usual forms, and asks
  before pushing to `main`, merging, or the usual Supabase commands that touch the live project. Your own
  `.claude/settings.local.json` (ignored by git) can add rules but can't lift these.
- When a Claude Code session starts, it installs the npm packages if they're missing
  (`.claude/hooks/session-start.sh`), on your computer or on the web.
- What actually protects the live site and data: helpers have no Vercel or Supabase access, and `main` only
  changes through a pull request the owner approves.

## For the owner

- Before running Claude on a helper's branch, open the pull request's **Files changed**. If it touches
  `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.github/`, `package.json`, `package-lock.json` or `scripts/`, read those
  changes first, and turn off the Supabase connector for that session.
- Keep `main` protected and secret scanning on: the clicks are in [GO_LIVE.md](GO_LIVE.md), "GitHub settings".
