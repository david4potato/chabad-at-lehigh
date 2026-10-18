# Helping with Chabad at Lehigh

Thank you for helping. The app serves real students, including people with serious food allergies, so a few
rules matter more than speed.

## Getting access

The owner adds you on GitHub with the **Write** role (never Admin). You don't need Supabase, Vercel or email
accounts: you work on your own computer against a local copy of the database with **[DEMO]** data.

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

1. Branch from `main`. One change per pull request.
2. Before you push: `npm run lint`, `npm run typecheck`, `npm test`. Database changes: `npm run test:db`.
   Screens: `npm run build`, then `npm run test:e2e`.
3. Open a pull request into `main`. CI runs every check; the owner reviews and merges. A merge to `main`
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
- `.claude/settings.json` is shared by everyone: Claude can't read real `.env` files, deploy with the Vercel
  CLI or force-push, and it asks before any command that changes the live database.
- Claude Code on the web installs the npm packages when a session starts (`.claude/hooks/session-start.sh`).
- Personal settings go in `.claude/settings.local.json`, which isn't committed. They can add rules but can't
  lift the shared blocks.
