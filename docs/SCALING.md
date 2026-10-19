# Scaling

The app is built for one campus community on free or low-cost plans. This page lists what already holds up
as use grows, and what to change when a real need shows up. It follows [PHILOSOPHY.md](PHILOSOPHY.md): nothing
more is built for other communities until real use calls for it.

## What already scales

- **Rules in the database.** Capacity, the waitlist, approvals, menu publishing and notifications live in
  Postgres functions and row level security, so every page and any future client follow the same rules.
  Seats are counted under a row lock, so a rush of RSVPs can't overbook an event.
- **Indexes** on the lookups pages run most (events by date, RSVPs by event and by person, notifications by
  person, volunteer shifts by event and by time), on confirmed RSVPs for the attendance numbers, on email for
  invitations, and on the columns that deleting an account or an event has to clear. See
  [Measured on 19 Oct 2026](#measured-on-19-oct-2026).
- **Times** are stored in UTC (`timestamptz`) and shown in the community's time zone (`SITE.timeZone` in
  `src/config/site.ts`). Two notification functions in SQL repeat the zone ([REPLICATE.md](REPLICATE.md#time-zone)).
- **Mostly bounded lists.** Most list queries have a row cap (500 at most), and dashboard lists say so when
  they are full ("Showing the newest 100"). A few still load every matching row: My Events, an event's attendees
  and its dietary report, the ingredient list on a dish's page, the dish vote counts on the Dishes pages and
  event menus, dishes in the menu editor, and pending roles in People & roles. The database API returns at most
  1,000 rows per query (Supabase's default), so past that these lists are cut short without an error. At the
  measured scale the longest is the ingredient list (841 rows).
- **Nothing slow inside a request.** Notifications are written inside the database, by the same functions and
  triggers that change RSVPs, events, menus and shifts, and by the one that sends invitations. The app sends no
  email itself: Supabase sends sign-in emails, and "Email everyone going" opens the organizer's own email app.
- **Rate limits** in Postgres on RSVPs, votes, suggestions, volunteer sign-ups and invitations. Supabase limits
  sign-in emails.
- **Hosting.** Vercel runs each page request on its own and adds capacity as traffic grows; images and scripts
  come from its CDN. The app reaches the database through Supabase's web API, so it holds no database
  connections of its own.

## When to change what

| When this happens | Change |
| --- | --- |
| A list reaches its cap (for example more than 100 past events on Dashboard → Events) | Add paging or search to that list |
| A list without a cap grows to a few hundred rows | Give it a cap and paging |
| A dish's page has more than 1,000 ingredients to choose from | Replace the full ingredient list with a search |
| Dashboard → Overview gets slow (it rereads every confirmed RSVP to count new people) | Save each person's first visit instead of recounting it on every load |
| Public pages slow down under heavy traffic | Cache the parts of public event pages that don't depend on who is signed in. Cache Components is off today (`next.config.ts`); read `node_modules/next/dist/docs/01-app/02-guides/migrating-to-cache-components.md` first |
| Organizers want automatic email or text reminders | Send them from a scheduled job or queue, never inside a page request |
| The database nears the Free plan's size limit, or people rely on it daily | Supabase Pro: daily backups and no pausing (see the cost table in [SETUP.md](../SETUP.md)) |
| Organizers want roles of their own, or admins limited to one area | Today there are five fixed roles (student, community guest, organizer, kitchen staff, admin), checked in SQL and row level security and mirrored in `src/lib/roles.ts`. A new role or a scoped admin means a migration, new checks in the database functions and policies, the matching changes in `src/lib/roles.ts` and in the pages and actions that check roles, `npm run db:types`, and tests |
| A second community wants the app | Decide between the two models below |

## A second community: two models

1. **Its own copy (today).** With the owner's permission (there is no license yet), the community forks the
   repository, edits `src/config/site.ts` and its Settings, and runs its own Supabase project and Vercel site
   ([REPLICATE.md](REPLICATE.md)). Each community owns its data, including private dietary details, and nothing
   it does can affect another community.
2. **One shared deployment.** Every table gets a community id, every rule and index includes it, and a new
   community is new data instead of a new site. Fewer deployments to look after, but it is a large change to
   the database, and a mistake in one rule could show one community's data to another.

Model 1 needs no work now. Choose model 2 only if several communities commit to using the app and running
separate copies becomes the bigger cost.

## Measured on 19 Oct 2026

These are local Docker numbers (Supabase CLI stack, Postgres 17, 4 CPUs), not production hardware. Supabase's
Free plan runs on a shared CPU with up to 0.5 GB of memory, so expect slower times there; compare the before and
after columns, not the absolute values. How to repeat it: [supabase/perf/README.md](../supabase/perf/README.md).

### Data

Fake data from `supabase/perf/scale_seed.sql`, loaded into a copy of the local database (never the live project):
one large campus over about three years.

| What | Rows |
| --- | ---: |
| Accounts (3,100 students, 1,880 community, 20 staff, plus local test accounts) | 5,058 |
| Events (a Shabbat dinner every Friday, plus holidays, classes and socials) | 611 |
| RSVPs (35,867 going, 19,487 checked in) | 41,557 |
| Notifications | 150,199 |
| Audit log entries | 60,006 |
| Dietary profiles / allergies / meal notes | 1,989 / 1,670 / 2,067 |
| Ingredients / dishes / dish ingredients | 841 / 414 / 3,132 |
| Menu versions / menu items | 367 / 2,927 |
| Dish votes / suggestions | 2,429 / 350 |
| Volunteer shifts / sign-ups | 670 / 1,626 |
| Announcements | 302 |

### How it was measured

Each query is the SQL PostgREST runs for the page's supabase-js call (same filters, order and limit), or the
RPC. It runs as the real role (anon, or signed in as a student, organizer, kitchen staff member or admin), so
row level security applies. Every query ran 3 times in each of 3 passes before and 3 after the change; the table
shows the median. Writes ran inside a transaction that was rolled back, after a vacuum. Times leave out PostgREST
turning rows into JSON and the network. Times under 1 ms vary by about ±0.4 ms between passes, so a change counts
only when the number of pages read changes too.

### Before and after

| Query (page) | Who | Rows | Before ms | After ms | What changed |
| --- | --- | ---: | ---: | ---: | --- |
| `get_my_context` (every page, header) | student | 1 | 0.6 | 0.5 | Nothing needed |
| Next Shabbat dinner; upcoming events, limit 60 (home, /events) | anon | 1; 37 | 0.2; 0.1 | 0.2; 0.2 | Nothing needed |
| `get_event_counts`, 37 events (/events) | anon | 37 | 1.2 | 0.9 | Same plan; noise |
| Event by slug; its shifts; `get_event_menu` (event page) | anon | 1; 3; 1 | 0.03; 0.1; 1.0 | same | Nothing needed |
| `get_volunteer_counts`, 33 shifts (/volunteer) | student | 33 | 4.1 | 0.7 | Role check once per call instead of once per shift |
| All of one person's RSVPs (My Events) | student | 245 | 1.0 | 1.0 | Nothing needed |
| `get_my_stats` (My Events, Profile) | student | 1 | 7.2 | 5.8 | New attendance index; pages read 1,520 → 1,252 |
| Newest 50 notifications | student | 50 | 0.1 | 0.1 | Nothing needed |
| `get_staff_stats` (Dashboard → Overview) | organizer | 1 | 36.5 | 21.5 | New attendance index |
| `get_event_counts`, 26 drafts (Events → Drafts) | organizer | 26 | 3.0 | 0.9 | Role check once per call; pages read 149 → 74 |
| Attendees of a Shabbat dinner | organizer | 169 | 1.7 | 2.3 | Same plan; noise |
| `event_dietary_report`; `event_dietary_summary` | kitchen; organizer | 158; 1 | 4.0; 2.3 | same | Nothing needed |
| `get_person_history` (a person's page) | admin | 1 | 8.1 | 7.3 | New attendance index; pages read 1,872 → 1,604 |
| People: newest 50; search by name | admin | 50 | 3.5; 10–16 | same | Not changed (see below) |
| Audit log, newest 200, any filter | admin | ≤ 200 | 0.3–0.7 | same | Nothing needed |
| `staff_invite_to_event`, 50 emails | organizer | 50 | 16.3 | 11.8 | Email index; pages read 10,182 → 1,916 |
| `set_rsvp`; check in; mark notifications read | student; organizer | 1 | 2.0; 0.8; 1.8 | 2.6; 0.8; 2.4 | A few more index pages per write (102 → 105, 35 → 40, 853 → 899); time within noise |
| Delete account (student with 245 RSVPs) | student | – | 22.5 | 10.9 | Three partial indexes; see below |
| Delete account (organizer who checked in 1,618 people) | organizer | – | 108.9 | 109.1 | No gain: the time goes to updating about 7,400 rows |
| Delete a past Shabbat dinner | admin | – | 17.8 | 3.5 | Index on notifications by event |
| Dishes page allergens | kitchen | 1,300 → 636 | 1.1 | about 26 (via PostgREST) | App change, below |

**Dishes page.** It read the whole `dish_allergens` view (1,300 rows at this scale), and the API cut that to
1,000 rows, so some dishes showed no allergens. It now reads the allergens with each dish on the page: complete,
one request instead of two, 49 KB instead of 107 KB, but about 26 ms of database time instead of 2 ms. That is
fine for a staff page. A faster version would need a new database function.

**Deleting an account** clears the person from every table that points at them. Three of those columns had no
index, so every deletion read the whole table, even for someone who never checked anyone in:
`audit_events.actor_id` 4.9 ms, `rsvps.checked_in_by` 3.9 ms and `rsvps.decided_by` 3.6 ms, out of 17.2 ms for
the whole cascade. With partial indexes each takes 0.1 ms or less and the cascade takes 4.2 ms. Every other
column without an index that points at a person costs about 0.5 ms or less (`user_roles.granted_by` is the most).

### Indexes added

In `supabase/migrations/20261019000100_efficiency.sql`, about 4.2 MB in total. Creating all six took 0.18 s on
this data. The same migration makes `get_event_counts` and `get_volunteer_counts` check the viewer's role and
sign-in once per call. Results do not change.

| Index | Size | Used by |
| --- | ---: | --- |
| `rsvps_going_event_idx`: confirmed RSVPs by event, with the columns the attendance rule reads | 2.3 MB | `get_my_stats`, `get_staff_stats`, `get_person_history`, `get_people_activity` |
| `notifications_event_idx` (partial) | 1.1 MB | Deleting an event |
| `audit_events_actor_idx` (partial) | 0.4 MB | Deleting an account |
| `profiles_email_idx` | 0.2 MB | Invitations, giving a role by email |
| `rsvps_checked_in_by_idx`, `rsvps_decided_by_idx` (partial) | 0.2 MB | Deleting an account |

### Considered and not added

- **A narrower attendance index** (`event_id` plus `checked_in_at` only): 1.4 MB, but `get_staff_stats` went
  only from 37 to 29 ms, against 39 to 19 ms with the wider one in the same test.
- **Indexes on the other columns that point at people or events**: each costs 0.5 ms or less per deletion here
  (`user_roles.granted_by`, `dish_votes.user_id`, `event_meal_preferences.user_id`, `events.created_by`, the
  `created_by` columns of dishes, ingredients, menus, shifts and announcements, `dish_suggestions` and
  `announcements` when an event is deleted, `learning_signups.user_id`). The `allergen_code` columns point at a
  13-row table whose rows the app never deletes, so nothing ever cascades through them.
- **Audit log by type and date**: every filter already takes under 1 ms.
- **People list and search**: sorting 5,058 profiles takes 3.5 ms, and searching names takes 10–16 ms. Both are on
  an admin-only page; faster search would need the `pg_trgm` extension and three more indexes.
- **Rewriting `get_staff_stats`**: counting new people needs each person's first visit. A one-pass version would
  slow down `get_my_stats`, which runs far more often. It now takes 21.5 ms and grows with every RSVP ever made.

### Database size

The copy is 108 MB, against 13 MB before the fake data. The app's tables take 92 MB: notifications 47 MB, the
audit log 19 MB, RSVPs 15 MB, menu items 4.3 MB (frozen dish details), and everything else 2.2 MB or less each.
That is about 35 MB a year at this level of activity, so the Free plan's 500 MB would last roughly 14 years.
Supabase counts every database in the project, including its own system data, so keep some room. Read
notifications older than 90 days are deleted only when that person next reads their notifications, so people
who stop visiting keep theirs, and the audit log is never trimmed. If the database ever nears the limit, those
two tables are the place to start.

### Plan limits

Supabase numbers were read on 19 Oct 2026 from Supabase's public repository, which holds the source of
supabase.com/pricing and the docs: [plans.ts](https://github.com/supabase/supabase/blob/master/packages/shared-data/plans.ts),
[compute-and-disk.mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/compute-and-disk.mdx),
[database-size.mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/database-size.mdx),
[billing-on-supabase.mdx](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/platform/billing-on-supabase.mdx).
supabase.com itself could not be reached from the measuring machine, so check <https://supabase.com/pricing>
before deciding.

| | Supabase Free | Supabase Pro |
| --- | --- | --- |
| Price | $0 | From $25 a month (one project on Micro compute included) |
| Database size | 500 MB; above that the project goes read-only | 8 GB disk per project, then $0.125 per GB |
| Egress | 5 GB, plus 5 GB cached | 250 GB, plus 250 GB cached; then $0.09 and $0.03 per GB |
| Monthly active users | 50,000 | 100,000, then $0.00325 each |
| Pausing | After 1 week without activity; 2 active projects | Never |
| Compute | Nano: shared CPU, up to 0.5 GB memory | Micro: shared CPU, 1 GB memory |
| Database connections | 60 direct, 200 through the pooler | 60 direct, 200 through the pooler |
| Backups | Not listed | Daily, kept 7 days |

Vercel's limits are **unverified**: vercel.com could not be reached from the measuring machine. Check
<https://vercel.com/docs/limits> before deciding. Hobby has been known to include about 1,000,000 function
invocations and 100 GB of data transfer a month, with cron jobs at most once a day (all unverified). The app's
only cron runs once a day.

### Connections, caching, jobs and email

What is true today. None of it needed a change.

- **No connections to pool.** The app reaches Supabase only through supabase-js over HTTPS: PostgREST for data
  and RPCs, Supabase Auth for sign-in. It opens no Postgres connections of its own (`pg` is used only by tests).
- **Per-request caching.** `getViewer`, `getOrgSettings`, `getEventBySlug` and `getAdminEvent` use React's
  `cache()`, so the layout and the page share one call. Cache Components stays off (`next.config.ts`); don't add
  `'use cache'`.
- **Sign-in checks.** A signed-in page calls `getClaims()` twice (`src/proxy.ts` and `getViewer`). With the new
  JWT signing keys both are checked on the server against a cached public key; with the legacy JWT secret each
  one is a request to Supabase Auth (see `getClaims` in `@supabase/auth-js`). [SETUP.md](../SETUP.md) step 6
  explains the switch.
- **Jobs.** The only cron is `vercel.json`'s daily `/api/keepalive`, one tiny query that keeps a Free project
  from pausing.
- **Email.** The only emails are Supabase Auth's sign-in links and codes. Notifications are rows written inside
  the database by the same functions that change RSVPs, events, menus and shifts.
