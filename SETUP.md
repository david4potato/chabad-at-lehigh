# Setup guide

From zero to a live site in about an hour. Do the steps in order.

| Piece | Service | Cost |
| --- | --- | --- |
| Website | Vercel (Hobby) | Free |
| Database + sign-in | Supabase (Free) | Free |
| Sign-in emails | Resend (Free) — or Gmail | Free |
| Domain DNS | Cloudflare (Free) | Free (domain itself, if you buy one) |
| Code | GitHub | Free |

> **Before real use:** organizers review the workflow and the meal/allergy process with
> [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md). Dish votes are never proof that food is safe.

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → Publishable key (`sb_publishable_…`) |
| `NEXT_PUBLIC_SITE_URL` | Your site address, no trailing slash (Vercel URL first, custom domain later) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional — step 20 |

Never add the Supabase **secret / service_role** key anywhere — the app doesn't use it.

Dashboard links below use `/project/_/`, which opens your project.

## Part A — Supabase

1. <https://supabase.com> → **New project**: name `chabad-at-lehigh`, generate and save a database
   password, region **East US (North Virginia)** → **Create**. (Free plan: 2 active projects per organization.)
2. **SQL Editor → New query** (<https://supabase.com/dashboard/project/_/sql/new>) → paste **all** of
   `supabase/setup/all_migrations.sql` → **Run**. Expect *Success*. Run once, on a new project.
3. *Optional:* new query → paste `supabase/seed.sql` → **Run** for **[DEMO]** events and dishes (removed in step 23).
4. Check: **Table Editor** shows `events`, `rsvps`, `dishes`… and **Advisors → Security Advisor** shows no
   red errors. (Yellow warnings about public functions like `get_event_menu` are expected.)
5. Copy the **Project URL** (<https://supabase.com/dashboard/project/_/settings/api>) and the
   **Publishable key** (<https://supabase.com/dashboard/project/_/settings/api-keys>).
6. **Authentication → Email Templates** (<https://supabase.com/dashboard/project/_/auth/templates>):
   - **Magic Link** — subject `Your Chabad at Lehigh sign-in link`, body = `supabase/templates/magic_link.html` → Save.
   - **Confirm signup** — subject `Welcome to Chabad at Lehigh — confirm your email`, body = `supabase/templates/confirmation.html` → Save.
7. **Authentication → Providers → Email** (<https://supabase.com/dashboard/project/_/auth/providers>): Email enabled,
   *Confirm email* on.

## Part B — Email sender (required)

Supabase's built-in email only reaches your own team, so students need a real sender. You need **one**
SMTP sender — nothing else (no Loops/Mailchimp). Resend's free plan (3,000/month, 100/day) is plenty.

8. <https://resend.com> → **Domains → Add Domain** (e.g. `chabadlehigh.org`) → add the DNS records it shows in
   **Cloudflare → DNS → Records** (or use its *Sign in to Cloudflare* button) → **Verify** → **API Keys → Create** (Sending access).
9. Supabase → **Authentication → SMTP Settings** (<https://supabase.com/dashboard/project/_/auth/smtp>) → enable custom SMTP:
   sender `no-reply@chabadlehigh.org`, name `Chabad at Lehigh`, host `smtp.resend.com`, port `465`,
   username `resend`, password = Resend API key → Save.
   *No domain yet?* Use Gmail: turn on 2-Step Verification, create an App password, then host
   `smtp.gmail.com`, port `587`, username/sender = the Gmail address, password = the app password.
10. **Authentication → Rate Limits** (<https://supabase.com/dashboard/project/_/auth/rate-limits>): raise the email
    limit from 30 to about `100` per hour.

## Part C — First admin

11. SQL Editor → paste `supabase/scripts/bootstrap_admin.sql`, put **your** email in → **Run**. You become admin
    when you sign in. Manage everyone else in the app: **Dashboard → People & roles**.

## Part D — GitHub

12. If `chabad-at-lehigh` isn't in your GitHub yet: <https://github.com/new> → private, no README → create → push
    (`git remote add origin https://github.com/<you>/chabad-at-lehigh.git && git push -u origin main`).

## Part E — Vercel

13. <https://vercel.com> (sign in with GitHub) → **Add New → Project** → import `chabad-at-lehigh`
    (not listed? *Adjust GitHub App Permissions*).
14. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → **Deploy** → copy your
    address (e.g. `https://chabad-at-lehigh.vercel.app`).
15. Supabase → **Authentication → URL Configuration** (<https://supabase.com/dashboard/project/_/auth/url-configuration>):
    Site URL = your Vercel address; Redirect URLs → add `https://your-address/**` (and `http://localhost:3000/**`
    for local development) → Save.
16. Vercel → add `NEXT_PUBLIC_SITE_URL` = your Vercel address → **Deployments → ⋯ → Redeploy**
    (variable changes need a redeploy).

## Part F — Custom domain (Cloudflare, optional)

17. Vercel → **Settings → Domains → Add** your domain (+ `www` redirect). Note the DNS records it shows.
18. Cloudflare → **DNS → Records** → add exactly those records with **Proxy status: DNS only** (grey cloud).
    Wait for **Valid Configuration** in Vercel.
19. Switch to the domain: Vercel `NEXT_PUBLIC_SITE_URL` = `https://yourdomain` → Redeploy; Supabase Site URL =
    `https://yourdomain` and add Redirect URL `https://yourdomain/**`.
20. *Optional bot check:* Cloudflare **Turnstile → Add widget** (your hostnames) → put the **Secret key** in
    Supabase **Authentication → Attack Protection** (CAPTCHA: Turnstile) and the **Site key** in Vercel as
    `NEXT_PUBLIC_TURNSTILE_SITE_KEY` → Redeploy. Do both together or sign-in fails.

## Part G — Check it works

21. Open the site on a phone and a computer: home, Events, Find Us and footer links load.
22. **Sign in** → email arrives with a button and a code → welcome form → you see **Dashboard**.
23. **Dashboard → Settings**: confirm the pre-filled contact details with the Greenbergs (from public listings:
    Rabbi Zalman & Dit Greenberg, rabbi@chabadlehigh.org, (610) 419-9036, 306 Wyandotte Street) and add parking.
    If you loaded demo data, run `supabase/scripts/remove_demo_data.sql`.
24. Create and publish a test event; from a second account try **Going / Not going / Change RSVP**, the
    waitlist (small capacity) and **Invite friends**.
25. Add a dish with ingredients → event **Menu** → tick the preparation confirmation → **Publish**. Signed out,
    the menu and allergens show; dietary data doesn't.
26. Post an **urgent** menu update → the second account's bell shows it.
27. Give someone **Kitchen staff** → only kitchen/admins see names on the **Dietary** tab.
28. On a throwaway account: **Profile & settings → Delete account** works. Then have organizers sign off on
    [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md).

## Troubleshooting

| Problem | Fix |
| --- | --- |
| No sign-in email / "Email address not authorized" | Part B isn't done. Check spam. |
| "Link expired" | Links work once (1 hour). Use the code from the newest email. |
| Link opens `localhost` or the wrong site | Fix Site URL / Redirect URLs (step 15/19) and `NEXT_PUBLIC_SITE_URL`, then redeploy. |
| "Missing Supabase settings" | Add the environment variables in Vercel and redeploy. |
| No Dashboard | Run step 11 with the exact email you sign in with, then sign out and in. |

## Local development

Needs Node.js 20.9+ and Docker.

```bash
npm install
npx supabase start          # local Supabase
npx supabase db reset       # migrations + DEMO seed
cp .env.example .env.local  # paste the local URL + publishable key from `npx supabase status`
npm run dev                 # http://localhost:3000 — emails appear at http://127.0.0.1:54324
```

Later database changes: run only the new files in `supabase/migrations/` in the SQL Editor, in order —
or `npx supabase link --project-ref <ref>` then `npx supabase db push`.
