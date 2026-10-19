# Scaling

The app is built for one campus community on free or low-cost plans. This page lists what already holds up
as use grows, and what to change when a real need shows up. The rule from [PHILOSOPHY.md](PHILOSOPHY.md):
nothing more is built until real use calls for it, but nothing is built in a way that would need a rewrite.

## What already scales

- **Rules in the database.** Capacity, the waitlist, approvals, menu publishing and notifications live in
  Postgres functions and row level security, so every page and any future client follow the same rules.
  Seats are counted under a row lock, so a rush of RSVPs can't overbook an event.
- **Indexes** on the lookups pages run most (events by date, RSVPs by event and by person, notifications by
  person, volunteer shifts by event and by time).
- **Times** are stored in UTC (`timestamptz`) and shown in the community's time zone (`SITE.timeZone` in
  `src/config/site.ts`).
- **Bounded lists.** Every list query has a cap (50 to 500 rows), so no page loads an unbounded table.
- **Nothing slow inside a request.** Notifications are written by database triggers. The app sends no email
  itself: Supabase sends sign-in emails, and "Email everyone going" opens the organizer's own email app.
- **Rate limits** in Postgres on RSVPs, votes, suggestions, volunteer sign-ups and invitations. Supabase limits
  sign-in emails.
- **Hosting.** Vercel runs each page request on its own and adds capacity as traffic grows; images and scripts
  come from its CDN. The app reaches the database through Supabase's web API, so it holds no database
  connections of its own.

## When to change what

| When this happens | Change |
| --- | --- |
| A list reaches its cap (for example more than 50 people in People & roles) | Add paging or search to that list |
| Public pages slow down under heavy traffic (hundreds of visitors at once) | Cache public event pages; see `node_modules/next/dist/docs` on Cache Components |
| Organizers want automatic email or text reminders | Send them from a scheduled job or queue, never inside a page request |
| The database nears the free plan's 500 MB, or people rely on it daily | Supabase Pro: daily backups and no pausing |
| A second community wants the app | Decide between the two models below |

## A second community: two models

1. **Its own copy (today).** The community forks the repository, edits `src/config/site.ts` and its Settings,
   and runs its own Supabase project and Vercel site ([REPLICATE.md](REPLICATE.md)). Each community owns its
   data, including private dietary details, and nothing it does can affect another community.
2. **One shared deployment.** Every table gets a community id, every rule and index includes it, and a new
   community is new data instead of a new site. Fewer deployments to look after, but it is a large change to
   the database, and a mistake in one rule could show one community's data to another.

Model 1 needs no work now. Choose model 2 only if several communities commit to using the app and running
separate copies becomes the bigger cost.
