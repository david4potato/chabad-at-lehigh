# Going live

David's steps from here to students using the site, in order. Each step says where to go, what to do, about how
long it takes and what must come first. [SETUP.md](SETUP.md) has the full reference for each screen.

## Where things stand

- **Code:** this repository, branch `main`. Every merge to `main` deploys to the Vercel project `chabad-at-lehigh`.
- **Website:** the address is in Vercel → **chabad-at-lehigh** → **Overview** → **Domains**, probably
  `https://chabad-at-lehigh.vercel.app`. Anyone with the address can open it. Every page asks search engines not to
  list it.
- **Database:** David created the Supabase project on 18 October 2026. Step 1 checks whether it's loaded.
- **Still open on the code side:** nothing that blocks launch.

## David's steps

1. **Load the database** (5 min). Comes first.
   - Supabase → the project → **Table Editor**. If `events`, `rsvps` and `dishes` are listed, the database was
     loaded earlier: run `supabase/migrations/20261019000100_efficiency.sql` once in **SQL Editor → New query** (it
     adds the indexes measured in [docs/SCALING.md](docs/SCALING.md); running it again does no harm), then go to
     step 2.
   - Otherwise: **SQL Editor → New query** → paste all of `supabase/setup/all_migrations.sql` → **Run**. Expect
     *Success*.
   - New query → paste `supabase/scripts/bootstrap_admin.sql` with your own sign-in email → **Run**.
   - **Advisors → Security Advisor:** no red errors. Yellow warnings about public functions are expected.
2. **Connect Vercel** (5 min). After step 1.
   - Vercel → **chabad-at-lehigh** → **Settings → Environment Variables**. Add these for Production and Preview:
     - `NEXT_PUBLIC_SUPABASE_URL`: Supabase → **Project Settings → Data API → Project URL**
     - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: Supabase → **Project Settings → API Keys → Publishable key**
       (`sb_publishable_…`)
   - Never add the secret or service_role key anywhere.
   - **Deployments** → newest Production → **⋯ → Redeploy**. Copy the address.
   - The project is already connected to this repository. Don't import it again.
3. **Sign-in settings** (10 min). After step 2, which gives you the address.
   - Supabase → **Authentication → URL Configuration**:
     - **Site URL** = the address, with no slash at the end.
     - **Redirect URLs** → add the address followed by `/**`.
     - **Save**.
   - **Email Templates:**
     - **Magic Link:** subject `Your Chabad at Lehigh sign-in link`, body `supabase/templates/magic_link.html`.
     - **Confirm signup:** subject `Welcome to Chabad at Lehigh — confirm your email`, body
       `supabase/templates/confirmation.html`.
   - **Providers → Email:** leave **Confirm email** on.
   - **Rate Limits:** set email to `100` per hour.
4. **Email sender** (10 min). After step 1. Without it, students get no sign-in emails.
   - Supabase → **Authentication → SMTP Settings** → enable custom SMTP.
   - Quickest: a Gmail account with 2-Step Verification and an App password:
     - host `smtp.gmail.com`, port `587`;
     - username and sender = the Gmail address;
     - password = the app password.
   - Use an address Chabad can own later.
5. **First sign-in** (10 min). After steps 1–4.
   - Open the site → **Sign in** → use the link or the 6-digit code → **Dashboard → Getting started**.
   - In **Settings**:
     - confirm the contact details with the directors (they were pre-filled from public sources);
     - add their phone number (shown as the allergy contact);
     - check parking.
   - **Remove demo content** if you loaded it.
6. **Your own test run** (30 min). After step 5.
   - Follow [SETUP.md](SETUP.md) Part G, steps 22–29, with a second email address.
   - That covers: a test event, RSVPs, the waitlist, a menu with ingredients, an urgent menu update, Kitchen staff
     on the Dietary tab, and deleting an account.
7. **Directors' review** (about 45 min for them). After step 6.
   - Send them your note.
   - Once they agree to look: **Dashboard → People & roles** → add both as **Admin**. This works before they sign in.
   - They go through [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md) on their own phones.
8. **Trial dinner** (one Shabbat). After step 7, when they're ready.
   - The directors invite a small group they choose.
   - Whoever cooks gets **Kitchen staff**.
   - They publish a menu with ingredients, print the Dietary report and check people in at the door.
9. **Written sign-off.** After step 8.
   - The directors confirm in writing (an email reply is enough) and list any changes they want.
   - Keep it private.
10. **Launch** (10 min). After step 9.
    - Check the Supabase project is on the Pro plan, so it has daily backups and never pauses.
    - Tell a Claude session "signed off". It turns on search listing (`listInSearchEngines` in
      `src/config/site.ts`) through a pull request.
    - The directors announce the site in their own channels.
11. **Ownership** (later, not needed for launch). Follow [HANDOFF.md](HANDOFF.md), "Account ownership and transfer".
    - Today GitHub, Vercel, Supabase and the email sender all sit in your accounts.
    - Move them to an owner Chabad controls in this order: Supabase, then GitHub, then Vercel, then the domain.

## A web address of their own (optional)

A choice for the directors, not a decision. The free `vercel.app` address is enough for steps 1–9. Buy nothing until
they say yes: the address carries their name, so register it in an account they own or will receive.

- **First choice:** `chabadatlehigh.org`. It matches their name, and .org suits a nonprofit.
- **Alternates:** `chabadatlehigh.com`, then `lehighchabad.org`.
- **Availability:** all three showed as available on 19 October 2026 in a registry check. That check quoted $16 for
  the first year. It was a one-time check, not a hold, and prices at Cloudflare or Vercel weren't checked.
- **Free option:** if `chabadlehigh.org` belongs to them (unverified), `app.chabadlehigh.org` costs nothing.
  - Whoever manages its DNS adds one CNAME record.
  - Don't touch its main, www or MX records.
- **On Vercel** (fewest steps): **Settings → Domains → Add** → type the address → buy it there if offered. Vercel sets
  up DNS and https.
- **On Cloudflare** (about 20 min plus waiting for DNS):
  1. **Domain Registration → Register Domains** → search → **Purchase**.
  2. Vercel → **Settings → Domains → Add** the address. Let Vercel redirect `www` to it.
  3. Cloudflare → the domain → **DNS → Records** → add exactly what Vercel shows, with **Proxy status: DNS only**.
  4. Wait for **Valid Configuration** in Vercel.
- **Then, either way:**
  - Set Vercel `NEXT_PUBLIC_SITE_URL` = `https://<address>` → **Redeploy**.
  - In Supabase **URL Configuration**, set **Site URL** to the same and add the Redirect URL `https://<address>/**`.
    Keep the vercel.app one until sign-in works.

## How to check it worked

- **Step 1:** the tables are listed, and Security Advisor shows no red errors.
- **Step 2:** the home and Events pages load without "Missing Supabase settings".
- **Steps 3–4:** the sign-in email arrives within a minute. Its link opens your site, not `localhost`, and the code
  works.
- **Step 5:** you see **Dashboard**, and the Getting started items tick off.
- **Domain:** Vercel says **Valid Configuration**, the site loads on https, and sign-in links use the new address.
- **Always:** the checks on `main` are green, and the latest Vercel production deployment is **Ready**.

## How to undo

| What went wrong | Undo |
| --- | --- |
| A bad deploy | Vercel → **Deployments** → the previous Ready production deployment → **⋯ → Instant Rollback** |
| A wrong variable | Fix or delete it in **Settings → Environment Variables** → **Redeploy** |
| A wrong role | **People & roles** → remove it. The app won't remove the last admin. |
| Email trouble | Supabase **SMTP Settings** → turn custom SMTP off. Emails then reach only your Supabase team. |
| Search listing too early | Revert that pull request |
| A domain | Remove it in Vercel **Domains**, delete its DNS record, and put back `NEXT_PUBLIC_SITE_URL` and the Site URL. A purchase can't be refunded, but auto-renew can be turned off. |
| Data deleted or damaged by mistake | Supabase → **Database → Backups** → pick a day → **Restore** (Pro plan only; daily copies kept 7 days). Everything since that day is lost. |
| The schema load failed on the new project (before any real data) | Delete the project (**Project Settings → General**) and create it again |

## Not live until the directors sign off

- No link to students, and no posts or announcements.
- Search listing stays off.
- Demo content is removed before anyone outside the test group sees the site.
- No license file until David and the directors agree ([docs/DECISIONS.md](docs/DECISIONS.md)).
- No domain is bought until the directors say yes.
- The bot check (Turnstile) needs both keys set together, or none. Half of it breaks sign-in.

## Key documents

| Document | What it's for |
| --- | --- |
| [GO_LIVE.md](GO_LIVE.md) | This page: the steps to launch |
| [SETUP.md](SETUP.md) | Every setup screen in detail, environment variables, troubleshooting |
| [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md) | The directors' review and sign-off checklist |
| [docs/ORGANIZER_QUICKSTART.md](docs/ORGANIZER_QUICKSTART.md) | One page for the people who run Chabad |
| [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md) | The rules the app never breaks, including meal and allergy safety |
| [docs/DECISIONS.md](docs/DECISIONS.md) | What was decided, why, and what is still open |
| [HANDOFF.md](HANDOFF.md) | Passing the app to new volunteers or a new owner |
| [docs/REPLICATE.md](docs/REPLICATE.md) | Running a copy for another community |
| [docs/SCALING.md](docs/SCALING.md) | What grows, what it costs, and what to change when |
| [docs/one-pager/one-pager.pdf](docs/one-pager/one-pager.pdf) | One-page overview to show the directors |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How helpers work on the code |
| [README.md](README.md) | Features and how the code is laid out |

The executive summary, the message drafts to the directors and the contact list are private. They were sent to
David in his Claude chat and aren't in this repository.
