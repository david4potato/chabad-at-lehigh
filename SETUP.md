# Setup guide (beginner friendly)

This guide takes you from zero to a live site. Follow the steps in order; each one says
exactly where to click. Expect about 60–90 minutes the first time.

**What runs where**

| Piece | Service | Cost |
| --- | --- | --- |
| Website (Next.js app) | **Vercel** (Hobby plan) | Free |
| Database, sign-in, file storage | **Supabase** (Free plan) | Free |
| Sending sign-in emails | **Resend** (Free plan) — or a Gmail account | Free |
| Domain name DNS | **Cloudflare** (Free plan) | Free (you pay only for the domain itself, if you buy one) |
| Code | **GitHub** | Free |

> Vercel only hosts the website. It does **not** provide sign-in, a database, or email
> delivery — that's why Supabase and an email sender are part of the setup.

> **Before real use:** ask the Chabad organizers to review and approve the workflow — especially
> the meal and allergy process — using [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md).
> Students voting for a dish must never be treated as proof that it is safe for anyone with an allergy.

---

## Environment variable checklist

You will add these in **Vercel → your project → Settings → Environment Variables**
(and in `.env.local` for local development). See `.env.example` for comments.

| Name | Required? | Where to find it | Example |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase → **Project Settings → Data API** → Project URL (or the **Connect** button on the project home) | `https://abcdxyz.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase → **Project Settings → API Keys** → **Publishable key** (`sb_publishable_…`). The legacy *anon* key also works. | `sb_publishable_…` |
| `NEXT_PUBLIC_SITE_URL` | Yes (production) | Your site's address, no trailing slash. First your Vercel URL, later your custom domain. | `https://chabadlehigh.org` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Optional | Cloudflare → Turnstile (see steps 31–33). Leave empty unless you enable it in Supabase too. | `0x4AAAA…` |

**Never** add the Supabase *secret* or *service_role* key to Vercel — this app doesn't use it.

---

## Part A — Supabase (database + sign-in)

1. Go to <https://supabase.com> and sign in (GitHub sign-in is easiest).
2. Click **New project**. Choose the organization you want it in (a separate organization for
   Chabad is a good idea; the free plan allows 2 active projects per organization).
3. Fill in: **Name** `chabad-at-lehigh`; **Database password** → click *Generate a password* and
   save it in a password manager; **Region** → *East US (North Virginia)* (closest to Bethlehem, PA).
   Click **Create new project** and wait ~2 minutes until it says the project is ready.
4. In the left sidebar open **SQL Editor** → **New query**
   (direct link: <https://supabase.com/dashboard/project/_/sql/new> — the `_` picks your project).
5. On GitHub (or your computer) open the file `supabase/setup/all_migrations.sql`, copy **all** of
   it, paste it into the SQL Editor and click **Run**. You should see *Success. No rows returned*.
   (Run it only once, on a new project.)
6. *(Optional, for trying the app)* Open a new query, paste all of `supabase/seed.sql`, click
   **Run**. This adds clearly labelled **[DEMO]** events, dishes and announcements. You'll remove
   them in step 36.
7. Check it worked: sidebar → **Table Editor** — you should see tables such as `events`, `rsvps`,
   `dishes`, `dietary_profiles`. Then sidebar → **Advisors → Security Advisor** → there should be
   no red "Error" items. A few yellow warnings about functions that anyone can call (such as
   `get_event_menu`, `get_event_counts`, `has_role`) are expected: they only return public
   information or answer "no" for visitors.
8. Sidebar → **Project Settings → Data API** (<https://supabase.com/dashboard/project/_/settings/api>): copy the **Project URL** into a note
   (`NEXT_PUBLIC_SUPABASE_URL`).
9. **Project Settings → API Keys** (<https://supabase.com/dashboard/project/_/settings/api-keys>): copy the **Publishable key** (`sb_publishable_…`) into the
   same note (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Do not copy the secret key.

### Sign-in emails

10. Sidebar → **Authentication → Emails / Email Templates**
    (<https://supabase.com/dashboard/project/_/auth/templates>). Open the **Magic Link** template:
    - **Subject:** `Your Chabad at Lehigh sign-in link`
    - **Body:** replace everything with the contents of `supabase/templates/magic_link.html`.
    - Click **Save**.
11. Open the **Confirm signup** template:
    - **Subject:** `Welcome to Chabad at Lehigh — confirm your email`
    - **Body:** replace with the contents of `supabase/templates/confirmation.html`. **Save**.

    These emails contain both a button (works on any device) and a 6-digit code (handy when
    someone reads email on their phone but signs in on a laptop).
12. **Authentication → Sign In / Providers → Email** (<https://supabase.com/dashboard/project/_/auth/providers>): make sure **Email** is enabled. Leave
    *Confirm email* on. Save if you changed anything.

### Email delivery (required for real use)

Supabase's built-in email only delivers to members of your Supabase team, a few per hour. To
email students you need your own sender. **Resend** (free: 3,000 emails/month) is recommended;
it needs a domain you control (step 13). No domain yet? Use the Gmail option in step 17.

13. Create a free account at <https://resend.com>. Go to **Domains → Add Domain** and enter your
    domain (for example `chabadlehigh.org`, or a sub-domain like `mail.chabadlehigh.org`).
14. Resend shows a few DNS records (TXT/MX). Add them in **Cloudflare → your domain → DNS →
    Records → Add record**, copying each **Type / Name / Value** exactly (Resend also offers an
    automatic *Sign in to Cloudflare* button). Back in Resend click **Verify** (can take a few minutes).
15. In Resend go to **API Keys → Create API Key** (permission: *Sending access*). Copy it.
16. In Supabase: **Authentication → Emails → SMTP Settings** (<https://supabase.com/dashboard/project/_/auth/smtp>) → turn on **Enable custom SMTP**:
    - Sender email: `no-reply@chabadlehigh.org` (your verified domain)
    - Sender name: `Chabad at Lehigh`
    - Host: `smtp.resend.com` · Port: `465` · Username: `resend` · Password: *the Resend API key*
    - Click **Save**.
17. *(Alternative without a domain — Gmail)* Turn on 2-Step Verification for the Gmail account,
    create an **App password** (Google Account → Security → App passwords), then in the same
    Supabase SMTP form use Host `smtp.gmail.com`, Port `587`, Username = the Gmail address,
    Password = the app password, Sender email = the same Gmail address.
18. **Authentication → Rate Limits** (<https://supabase.com/dashboard/project/_/auth/rate-limits>): after enabling custom SMTP the email limit starts at 30 per
    hour. Raise *Rate limit for sending emails* to about `100` and **Save**.

### Make yourself the first admin

19. **SQL Editor → New query** → paste `supabase/scripts/bootstrap_admin.sql`, replace
    `YOUR-EMAIL@lehigh.edu` with **your** email, click **Run**. You'll become admin the first time
    you sign in (or immediately if you already have). Everyone else's roles are managed inside the
    app: **Dashboard → People & roles**.

---

## Part B — GitHub (your code)

20. If the code is already in your GitHub account (repository `chabad-at-lehigh`), skip to step 22.
21. Otherwise: <https://github.com/new> → name `chabad-at-lehigh` → **Private** → do **not** add a
    README → **Create repository**, then push this project to it
    (`git remote add origin https://github.com/<you>/chabad-at-lehigh.git && git push -u origin main`).

## Part C — Vercel (the website)

22. Go to <https://vercel.com>, sign up/in **with GitHub**.
23. Click **Add New… → Project** → find `chabad-at-lehigh` → **Import**. (If it's not listed, click
    *Adjust GitHub App Permissions* and give Vercel access to that repository.)
24. Vercel detects **Next.js** automatically. Open **Environment Variables** and add:
    - `NEXT_PUBLIC_SUPABASE_URL` = your Project URL (step 8)
    - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = your publishable key (step 9)
    - `NEXT_PUBLIC_SITE_URL` = leave for now (step 27)
25. Click **Deploy** and wait (~2 minutes). When it finishes, copy your production address, e.g.
    `https://chabad-at-lehigh.vercel.app`.
26. Back in **Supabase → Authentication → URL Configuration** (<https://supabase.com/dashboard/project/_/auth/url-configuration>):
    - **Site URL:** your Vercel address (e.g. `https://chabad-at-lehigh.vercel.app`)
    - **Redirect URLs → Add URL:** `https://chabad-at-lehigh.vercel.app/**`
      (and `http://localhost:3000/**` if you'll develop locally). **Save**.
27. In **Vercel → Project → Settings → Environment Variables** add `NEXT_PUBLIC_SITE_URL` = your
    Vercel address (no trailing slash). Then **Deployments → ⋯ on the latest → Redeploy**.
    (Environment variable changes only apply after a redeploy.)

## Part D — Custom domain with Cloudflare (optional but recommended)

28. **Vercel → Project → Settings → Domains → Add** → type your domain (e.g. `chabadlehigh.org`)
    → choose to also add `www` and redirect it. Vercel shows the DNS records it needs.
29. In **Cloudflare → your domain → DNS → Records**, add exactly the records Vercel shows
    (typically an **A** record for the root domain and a **CNAME** for `www`). Set **Proxy status**
    to **DNS only** (grey cloud) for these records — Vercel handles HTTPS. Wait until Vercel's Domains
    page shows **Valid Configuration** (a few minutes, sometimes up to an hour).
30. Update the address everywhere:
    - Vercel → Environment Variables → `NEXT_PUBLIC_SITE_URL` = `https://chabadlehigh.org` → **Redeploy**.
    - Supabase → **Authentication → URL Configuration**: Site URL = `https://chabadlehigh.org`;
      add Redirect URL `https://chabadlehigh.org/**` (keep the vercel.app one too). **Save**.

### Optional: bot protection on the sign-in form (Cloudflare Turnstile)

31. Cloudflare dashboard → **Turnstile → Add widget** → hostname `chabadlehigh.org` (and your
    vercel.app address) → mode *Managed* → copy the **Site key** and **Secret key**.
32. Supabase → **Authentication → Attack Protection** → enable **CAPTCHA protection**, provider
    **Turnstile**, paste the **Secret key**, **Save**.
33. Vercel → add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` = the **Site key** → **Redeploy**.
    Do 32 and 33 together: if Supabase requires CAPTCHA but the site has no key, sign-in fails.

---

## Part E — Check that everything works (production verification)

34. Open your site on a phone and on a computer. The home page shows the Shabbat dinner card
    (if you loaded demo data), Events, Find Us, and the footer links work.
35. Click **Sign in**, enter your email. Within a minute you get an email with a **Sign in**
    button and a **code**. Use either. Complete the short welcome form. You should now see
    **Dashboard** in the top menu (because of step 19).
36. Dashboard → **Settings**: the contact details come pre-filled from public listings
    (Rabbi Zalman & Dit Greenberg, rabbi@chabadlehigh.org, (610) 419-9036, 306 Wyandotte Street).
    **Confirm them with the Greenbergs**, correct anything that's out of date, and add parking notes.
    Then remove the demo content: **SQL Editor → New query** → paste
    `supabase/scripts/remove_demo_data.sql` → **Run**.
37. Create a real test event (Dashboard → Events → New event), publish it, and RSVP from a
    second account (e.g. a friend's phone): try **Going**, **Not going** and **Change RSVP**.
    Set a small capacity to see the waitlist work.
38. Add a dish (Dashboard → Dishes) with ingredients, start a menu draft for the event
    (Event → Menu), tick the preparation confirmation and **Publish**. Open the event page signed
    out: the menu, ingredients and allergen labels are visible to everyone; dietary data is not.
39. Post an **urgent** menu update; the second account should see a red badge on the bell and the
    notice on the home page.
40. Give a trusted person the **Kitchen staff** role (Dashboard → People & roles) and confirm only
    kitchen staff/admins can see names on the event's **Dietary** tab, while organizers see counts.
41. Sign in with a throwaway test account, open **Profile & settings**, change your name, then
    use **Delete account** at the bottom (type DELETE). You should land on the home page signed out.
42. Supabase → **Advisors → Security Advisor**: no errors. Supabase → **Authentication → Users**:
    your test users appear.
43. Ask the Chabad organizers to go through [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md)
    and sign off before announcing the site.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Sign-in email never arrives / "Email address not authorized" | Custom SMTP isn't set up yet (steps 13–18). Check spam. |
| The email link says it expired | Links work once and expire after an hour. Some email security scanners open links automatically — use the **code** instead, or request a new email. |
| After clicking the link you land on `localhost` or the wrong site | Fix **Site URL** and **Redirect URLs** in Supabase (step 26/30) and `NEXT_PUBLIC_SITE_URL` in Vercel, then redeploy. |
| Site shows "Missing Supabase settings" | Add the environment variables in Vercel and **Redeploy**. |
| "You're doing that a lot" | Built-in rate limits — wait a few minutes. |
| I don't see the Dashboard | Run step 19 with the exact email you sign in with, then sign out and in again. |
| A sign-in code is rejected | Use the code from the most recent email; older codes stop working when a new one is sent. |

---

## Local development (optional, for developers)

Requirements: Node.js 20.9+ and Docker Desktop.

```bash
npm install
npx supabase start          # local Supabase (first run downloads Docker images)
npx supabase db reset       # applies migrations + DEMO seed
cp .env.example .env.local  # then paste the local URL + publishable key printed by `npx supabase status`
npm run dev                 # http://localhost:3000
```

Sign-in emails in local development are caught by Mailpit at <http://127.0.0.1:54324>.
To make a local account admin, run `supabase/scripts/bootstrap_admin.sql` with your email via
`psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f …` (after editing the email).

Updating the hosted database later: when new files appear in `supabase/migrations/`, run only the
new files in the SQL Editor, in order — or use the CLI: `npx supabase login`,
`npx supabase link --project-ref <ref>`, `npx supabase db push`.
