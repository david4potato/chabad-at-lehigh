# Setup guide

## Fastest path (about 30 minutes)

If Claude is helping you, it does the database, admin and code steps; you do the clicks below.

1. **Supabase project (1 min).** <https://supabase.com/dashboard> → **New project** → name `chabad-at-lehigh`,
   **Generate a password** (save it), region **East US**, size: leave the default → **Create**.
   Tell Claude "created", plus your email and Dit's. Claude loads the database, makes you both admins and sends you a
   block to paste into Vercel. (Doing it yourself: steps 2, 5 and 12 below.)
2. **GitHub repo (1 min).** <https://github.com/new> → `chabad-at-lehigh`, **Private**, no README → **Create**.
   Tell Claude, who pushes the code. (Yourself: step 14.)
3. **Vercel (5 min).** <https://vercel.com/new> → import `chabad-at-lehigh` → **Environment Variables** → paste the
   block from Claude (it fills both values) → **Deploy**. Copy the address it gives you (e.g. `https://chabad-at-lehigh.vercel.app`).
4. **Supabase → Authentication (10 min)** — four screens, links in steps 7, 10, 11 and 17:
   - **URL Configuration:** Site URL = your Vercel address; Redirect URLs → add `https://<your address>/**`.
   - **Email Templates:** Magic Link and Confirm signup — subjects and files in step 7.
   - **SMTP Settings:** quickest is a Gmail **app password** (step 10, no domain needed). Resend can come later.
   - **Rate Limits:** email → `100` per hour.
   (Providers → Email → *Confirm email* is on by default — leave it on.)
5. **Sign in (2 min)** on your site → **Dashboard** → the **Getting started** checklist: confirm the contact details,
   **add the Greenbergs' phone** and parking.
6. **Send Dit her sign-in note** (in [docs/ORGANIZER_QUICKSTART.md](docs/ORGANIZER_QUICKSTART.md)).

Later, when you have time: Resend with your own domain (step 9), `app.chabadlehigh.org` (Part F), the bot check
(step 21), and the organizer review + one trial dinner before announcing.

The rest of this guide is the full reference for each step.

| Piece | Service | Cost |
| --- | --- | --- |
| Website | Vercel (Hobby) | Free |
| Database + sign-in | Supabase | Free, or in a Pro organization $25/mo plus about $10/mo per extra project (never pauses, daily backups) |
| Sign-in emails | Resend (Free) — or Gmail | Free |
| Custom address (optional) | A subdomain of chabadlehigh.org, or a domain you buy | Free / domain price |
| Code | GitHub | Free |

Nothing else is needed — no Neon, Loops or Mailchimp.

> **Before real use:** organizers review the workflow and the meal/allergy process with
> [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md). Dish votes are never proof that food is safe.
> Send the people who run Chabad [docs/ORGANIZER_QUICKSTART.md](docs/ORGANIZER_QUICKSTART.md).

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → Publishable key (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | Optional on Vercel (it uses your Vercel production address). Set it only for a custom address, with `https://` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional — step 21 |

Never add the Supabase **secret / service_role** key anywhere — the app doesn't use it.

Dashboard links below use `/project/_/`, which opens your project.

## Part A — Supabase

1. <https://supabase.com> → **New project**: name `chabad-at-lehigh`, generate and save a database password,
   region **East US (North Virginia)**, compute size: leave the default → **Create**. Free plan: 2 active projects per person,
   and idle projects pause after a week (the site pings it daily to prevent that). Pro never pauses.
2. **SQL Editor → New query** (<https://supabase.com/dashboard/project/_/sql/new>) → paste **all** of
   `supabase/setup/all_migrations.sql` → **Run**. Expect *Success*. Run once, on a new project.
3. *Optional:* new query → paste `supabase/seed.sql` → **Run** for **[DEMO]** events and dishes (removed in step 24).
4. Check: **Table Editor** shows `events`, `rsvps`, `dishes`… and **Advisors → Security Advisor** shows no
   red errors. (Yellow warnings about public functions like `get_event_menu` are expected.)
5. Copy the **Project URL** (<https://supabase.com/dashboard/project/_/settings/api>) and the
   **Publishable key** (<https://supabase.com/dashboard/project/_/settings/api-keys>).
6. *Optional speed-up:* **Project Settings → JWT Keys** (<https://supabase.com/dashboard/project/_/settings/jwt>): if the
   current key says *Legacy JWT secret*, click **Migrate**, then **Rotate** to the new ECC key (before launch). Pages then
   check sign-ins without an extra call to Supabase. Newer projects already use ECC.
7. **Authentication → Email Templates** (<https://supabase.com/dashboard/project/_/auth/templates>):
   - **Magic Link** — subject `Your Chabad at Lehigh sign-in link`, body = `supabase/templates/magic_link.html` → Save.
   - **Confirm signup** — subject `Welcome to Chabad at Lehigh — confirm your email`, body = `supabase/templates/confirmation.html` → Save.
8. **Authentication → Providers → Email** (<https://supabase.com/dashboard/project/_/auth/providers>): Email enabled,
   **Confirm email on** (on by default; required — it's part of what keeps accounts from being claimed by someone else).

## Part B — Email sender (required)

Supabase's built-in email only reaches your own team, so students need a real sender. You need **one** SMTP sender.

9. **Resend** (free: 3,000/month, 100/day, **one sending domain per account**). If your Resend account already
   uses its free domain for another project, create a separate free account for Chabad (ideally with a Chabad email,
   so they own it). <https://resend.com> → **Domains → Add Domain**. Use a subdomain such as `mail.chabadlehigh.org`
   (ask whoever manages chabadlehigh.org's DNS to add the records Resend shows — this doesn't affect their website or
   email) or a domain you own → **Verify** → **API Keys → Create** (Sending access).
10. Supabase → **Authentication → SMTP Settings** (<https://supabase.com/dashboard/project/_/auth/smtp>) → enable custom SMTP:
    sender `no-reply@mail.chabadlehigh.org` (your verified domain), name `Chabad at Lehigh`, host `smtp.resend.com`,
    port `465`, username `resend`, password = Resend API key → Save.
    *No domain yet?* Use Gmail: turn on 2-Step Verification, create an App password, then host
    `smtp.gmail.com`, port `587`, username/sender = the Gmail address, password = the app password.
11. **Authentication → Rate Limits** (<https://supabase.com/dashboard/project/_/auth/rate-limits>): raise the email
    limit from 30 to about `100` per hour.

## Part C — Admins

12. SQL Editor → paste `supabase/scripts/bootstrap_admin.sql`, put **your** email in → **Run**. You become admin
    when you sign in.
13. After the site is live (step 23): **Dashboard → People & roles** → add the Greenbergs (and one more trusted
    person) as **Admin**. It works before they've signed in. Keep at least two admins.

## Part D — GitHub

14. If `chabad-at-lehigh` isn't in your GitHub yet: <https://github.com/new> → private, no README → create → push
    (`git remote add origin https://github.com/<you>/chabad-at-lehigh.git && git push -u origin main`).

## Part E — Vercel

15. <https://vercel.com> (sign in with GitHub) → **Add New → Project** → import `chabad-at-lehigh`
    (not listed? *Adjust GitHub App Permissions*).
16. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → **Deploy** → copy your
    address (e.g. `https://chabad-at-lehigh.vercel.app`).
17. Supabase → **Authentication → URL Configuration** (<https://supabase.com/dashboard/project/_/auth/url-configuration>):
    Site URL = your Vercel address; Redirect URLs → add `https://your-address/**` (and `http://localhost:3000/**`
    for local development) → Save.
18. Nothing else to set in Vercel: the site uses its Vercel production address automatically. (Set
    `NEXT_PUBLIC_SITE_URL` only when you add a custom address — step 20.)

## Part F — Custom address (optional)

chabadlehigh.org is Chabad's existing website and email. **Don't change its nameservers or its main/www/MX records** —
that would take down the current site and rabbi@ email. Use a subdomain instead, such as `app.chabadlehigh.org`.

19. Vercel → **Settings → Domains → Add** `app.chabadlehigh.org` (only that). Vercel shows one CNAME record. Ask whoever
    manages chabadlehigh.org's DNS to add it. (For a domain you own in Cloudflare, add it there yourself with
    **Proxy status: DNS only**.) Wait for **Valid Configuration**.
20. Switch to the new address: Vercel `NEXT_PUBLIC_SITE_URL` = `https://app.chabadlehigh.org` → Redeploy; Supabase
    Site URL = the same, and add Redirect URL `https://app.chabadlehigh.org/**`.
21. *Optional bot check:* Cloudflare **Turnstile → Add widget** (your hostnames) → put the **Secret key** in
    Supabase **Authentication → Attack Protection** (CAPTCHA: Turnstile) and the **Site key** in Vercel as
    `NEXT_PUBLIC_TURNSTILE_SITE_KEY` → Redeploy. Do both together or sign-in fails.

## Part G — Check it works

22. Open the site on a phone and a computer: home, Events, Find Us and footer links load.
23. **Sign in** → email arrives with a button and a code → welcome form → optional allergy screen (**Skip for now**) → you see **Dashboard**, with a
    **Getting started** checklist. Do step 13 now.
24. Follow the checklist: **Settings** — confirm the contact details with the Greenbergs (pre-filled from public
    sources: Rabbi Zalman & Dit Greenberg, rabbi@chabadlehigh.org, 306 Wyandotte Street), **add their phone number**
    (shown as the allergy contact) and parking. Then **Remove demo content** if you loaded it.
25. Create and publish a test event; from a second account try **Going / Not going / Change RSVP**, the
    waitlist (small capacity) and **Invite friends**.
26. Add a dish with ingredients → event **Menu** → tick the preparation confirmation → **Publish**. Signed out,
    the menu and allergens show; dietary data doesn't.
27. Post an **urgent** menu update → the second account's bell shows it.
28. Give someone **Kitchen staff** → only kitchen/admins see names on the **Dietary** tab.
29. On a throwaway account: **Profile & settings → Delete account** works. Then have organizers sign off on
    [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| No sign-in email / "Email address not authorized" | Part B isn't done. Check spam. |
| "Link expired" | Links work once (1 hour). Use the code from the newest email. |
| Link opens `localhost` or the wrong site | Fix Site URL / Redirect URLs (step 17/20) and `NEXT_PUBLIC_SITE_URL`, then redeploy. |
| "Missing Supabase settings" | Add the environment variables in Vercel and redeploy. |
| No Dashboard | Run step 12 with the exact email you sign in with, then sign out and in. |
| Someone needs a different sign-in email | Project owner: Supabase → **Authentication → Users** → the user → change email. If it's a Lehigh address, give them **Student** in People & roles. |
| Site down, Supabase says "paused" (Free plan) | Supabase dashboard → the project → **Restore**. |

## Local development

Needs Node.js 20.9+ and Docker.

```bash
npm install
npx supabase start          # local Supabase
npx supabase db reset       # migrations + DEMO seed
cp .env.example .env.local  # paste the local URL + publishable key from `npx supabase status`
npm run dev                 # http://localhost:3000 — emails appear at http://127.0.0.1:54324
```

**Later database changes:** run only the new files in `supabase/migrations/` in the SQL Editor, in order. To use the
CLI instead: `npx supabase login`, `npx supabase link --project-ref <ref>`, then once (the SQL Editor setup records no
migration history) `npx supabase migration repair --status applied $(ls supabase/migrations | cut -c1-14)` for the
files already applied, check with `npx supabase migration list`, then `npx supabase db push`.
