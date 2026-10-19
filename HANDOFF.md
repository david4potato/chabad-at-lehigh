# Hand-off

How to pass this app on: to new volunteers in the same community, or to another community that wants its own
copy. With the steps below, the new people can run it without the original builder's help.

> **There is no license yet.** A copy for another community needs the repository owner's permission first.

## 1. Accounts and costs

| Account | What it's for |
| --- | --- |
| GitHub | The code, and the checks that run on every change |
| Vercel | The website |
| Supabase | The database and sign-in |
| An email sender (Resend, or Gmail to start) | Sign-in emails |
| Cloudflare (optional) | The bot check on the sign-in form (Turnstile, SETUP step 21) |
| A domain or subdomain (optional) | Your own web address and the Resend sending domain. Note who manages its DNS: they add the records for Vercel and Resend. |

The cost table near the top of [SETUP.md](SETUP.md) shows what each costs. Create every account with an address
your community controls, not one person's. Give at least two people access where the plan allows it (Vercel's
free Hobby plan is for one person). Move any paid plan to the community's billing before the person paying steps
down.

**Where the secrets are.** Vercel holds only public values ("Environment variables" in [SETUP.md](SETUP.md)). The
secrets live in Supabase: the email sender's password under **Authentication → SMTP Settings**, and the Turnstile
secret key under **Authentication → Attack Protection**. If the person who made one leaves, make a new one and
paste it in. A Gmail app password belongs to one person's account, so move to a community account or Resend
first. The app doesn't use the database password; reset it in Supabase → **Project Settings → Database** if the
person who saved it leaves.

## 2. Account ownership and transfer

Today one person owns the GitHub repository, the Vercel project and the Supabase project. When the community takes
them over, or new volunteers do:

1. **Choose the new owner.** An account or organization the community controls, so the site doesn't depend on one
   person.
2. **Supabase.** Move the project to the new owner's organization with the transfer option in its settings. The
   database and sign-in move with it. Then check **Authentication → SMTP Settings**: the email sender's password
   may belong to the old owner.
3. **Vercel.** Move the project to an account the new owner controls (the free Hobby plan has no team members; a
   paid Pro team does). Then check that **Settings → Environment Variables** still has the two Supabase values and
   **Settings → Domains** still lists any custom address.
4. **GitHub.** Transfer the repository in its settings, or add the new owner as an admin. After a transfer, check
   that Vercel still deploys from it (Vercel → **Settings → Git**).
5. **Domain.** If there's a custom address, move its registrar account too, or make sure the new team can reach
   whoever manages its DNS.
6. **Remove the old owner** from all three once everything works.

Only an account's current owner can transfer it.

**Public or private code.** On Vercel's free Hobby plan, a private repository deploys only changes made by the
Vercel account owner; changes from anyone else are blocked. So either keep the repository public while others help
(GitHub's free plan also protects `main` only for public repositories, see [CONTRIBUTING.md](CONTRIBUTING.md)),
keep it private and have the owner make every merge into `main`, or move to Vercel Pro. People's data is never in
the repository, only the code.

## 3. Passing it to new volunteers in the same community

1. **Admins.** A current admin adds the new people in **Dashboard → People & roles**, with the role each needs. It
   works before they've signed in. Keep at least two admins. The database won't remove the last one.
2. **Step down.** Once the new admins have signed in, remove the roles of everyone who is leaving in **People &
   roles**. Start with Admin and Kitchen staff: they see names next to allergies.
3. **Accounts.** Add the new people to the accounts or move them, as in section 2. Then remove the people who are
   leaving from all three: anyone in the Supabase project can read every table, dietary details included.
4. **Code owner.** If `main` requires code owner review ("For the owner" in [CONTRIBUTING.md](CONTRIBUTING.md)),
   put the new owner's GitHub username in `.github/CODEOWNERS`.
5. **Contacts.** Update the contact name, email and phone in **Dashboard → Settings**. The phone is shown as the
   allergy contact. Then check the **Contact** section of every upcoming event: an event's own contact replaces
   the one in Settings, on its menu too, and **Duplicate for next week** copies it.
6. **Rules.** Send the new people [docs/ORGANIZER_QUICKSTART.md](docs/ORGANIZER_QUICKSTART.md). The rules they keep
   are in [docs/PHILOSOPHY.md](docs/PHILOSOPHY.md) and "Rules that never change" in
   [docs/REPLICATE.md](docs/REPLICATE.md#rules-that-never-change).

## 4. Starting a copy for another community

Follow [docs/REPLICATE.md](docs/REPLICATE.md) from the top. It covers permission, the fork, every file and
setting to change, and setup with your own accounts. Three things matter most:

1. Ask the repository owner for permission before you fork, copy or run it.
2. Use your own name. Never reuse the original community's name, and never present your copy as theirs or as
   endorsed by them or by any university.
3. After your first sign-in, replace every field in **Dashboard → Settings** before you share the site. Save the
   student email domains before anyone else signs in.

One shared site for many communities isn't built yet. [docs/SCALING.md](docs/SCALING.md) explains when it would
be worth building.

## 5. Data

- **Nothing personal carries over.** A new copy starts with no people, events, RSVPs, dietary details or history.
  Only **Dashboard → Settings** starts filled in, with the original community's details, until you replace them.
  Never copy people's data from one copy to another.
- **Demo content.** `supabase/seed.sql` holds **[DEMO]** events, dishes, shifts and announcements for trying
  things out. It uses the original community's place names and address, so a copy skips it on its hosted project
  unless it edits the file. If it's loaded, remove it with **Remove demo content** in the **Getting started**
  checklist before you share the site.
- **Exports.** Each event's **Attendees & check-in** tab has **Download spreadsheet (CSV)**. It has no dietary
  data. Dietary details stay inside the app and its audited report. Never export them from the Supabase
  dashboard.
- **Backups.** Supabase Pro keeps daily backups (see the cost table in [SETUP.md](SETUP.md)). Move to Pro once
  people rely on the site, as [docs/SCALING.md](docs/SCALING.md) says. Don't keep copies of people's data outside
  the app.
- **People leaving.** Anyone can delete their dietary details (**Profile & settings → Dietary & allergies**) or
  their whole account (**Profile & settings**). The last admin has to make someone else admin first.

## 6. Updating safely

- Changes go through a branch and a pull request, and CI checks every pull request
  ([CONTRIBUTING.md](CONTRIBUTING.md)). The owner protects `main` as "For the owner" there describes. A merge to
  `main` updates the live site.
- Database changes are new files in `supabase/migrations/`. Run only the new ones, in order, as you merge.
  "Later database changes" at the end of [SETUP.md](SETUP.md) shows how.
- A copy pulls updates from this repository as "Getting updates later" in [docs/REPLICATE.md](docs/REPLICATE.md)
  describes.

## 7. Check that it works

1. Go through "Part G — Check it works" in [SETUP.md](SETUP.md) on a phone and a computer.
2. Every field in **Dashboard → Settings** is current, including the allergy contact phone.
3. `/privacy` and `/meal-safety` match how your community really handles information and food.
4. Your organizers and whoever cooks go through [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md) and sign
   it off.
5. A new copy holds one trial meal before it announces the site. At launch, set `listInSearchEngines: true` in
   `src/config/site.ts`, so search engines may list it.
