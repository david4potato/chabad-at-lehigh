# Helping with Chabad at Lehigh

Thank you for helping. The app serves real students, including people with serious food allergies, so a few
rules matter more than speed.

## Getting access

The owner invites you as a collaborator (GitHub → Settings → Collaborators). That lets you push branches and
open pull requests. Before inviting anyone, the owner protects `main`, so changes reach it only through a pull
request that passes CI and that the owner approves. You don't need Supabase, Vercel or email accounts: you work on your own computer against a
local copy of the database with **[DEMO]** data.

## Run it

Needs Node.js 20.9+ (22 recommended) and Docker.

```bash
npm install
npx supabase start          # local database, sign-in and email
npx supabase db reset       # tables + [DEMO] data
cp .env.example .env.local  # paste the local URL + publishable key from `npx supabase status`
npm run dev                 # http://localhost:3000 — sign-in emails appear at http://127.0.0.1:54324
```

## Make a change

1. Branch from `main`. One change per pull request. Never push to `main` directly.
2. Before you push: `npm run lint`, `npm run typecheck`, `npm test`. Database changes: `npm run test:db`.
   Screens: `npx playwright install chromium` (once), `npm run build`, then `npm run test:e2e`.
3. Open a pull request into `main`. CI runs every check, and the owner reviews and merges. A merge to `main`
   updates the live site.

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
- Claude Code on the web installs the npm packages when a session starts (`.claude/hooks/session-start.sh`).
- What actually protects the live site and data: helpers have no Vercel or Supabase access, and `main` only
  changes through a pull request the owner approves.

## For the owner

- Before running Claude on a helper's branch, open the pull request's **Files changed**. If it touches
  `.claude/`, `CLAUDE.md`, `AGENTS.md`, `.github/`, `package.json`, `package-lock.json` or `scripts/`, read those
  changes first, and turn off the Supabase connector for that session.
- Keep `main` protected (Settings → Branches): require a pull request with 1 approval and Code Owner review, and
  require both CI checks. On a free GitHub account this works only while the repo is public.
