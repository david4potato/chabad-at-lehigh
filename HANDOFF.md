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
them over, or new volunteers do, go in this order:

1. **Choose the new owner.** An account or organization the community controls, so the site doesn't depend on one
   person.
2. **Supabase.** The new owner first invites the current owner to their organization: a project only moves into an
   organization the current owner belongs to. Then the current owner uses the transfer option in **Project
   Settings → General**. The database, sign-in and their settings move with it. A Free organization has no daily
   backups and pauses idle projects, so keep the project on Pro once people rely on it. Then check
   **Authentication → SMTP Settings**: the email sender's password may belong to the old owner.
3. **GitHub.** Transfer the repository in **Settings → General → Danger Zone**, and the new owner accepts it. A
   repository on a personal account has no admin role, so adding the new owner as a collaborator isn't enough.
4. **Vercel.** A project only moves into a team the current owner belongs to, and the free Hobby plan has no
   members. So either:
   - The new owner imports the repository into their own Vercel account as a new project, and adds the two
     Supabase values (**Settings → Environment Variables**) and any custom address (**Settings → Domains**). A new
     project gets a new `vercel.app` address, so update Site URL and Redirect URLs in Supabase → **Authentication →
     URL Configuration** ([SETUP.md](SETUP.md) step 17), or sign-in links break. Then the old owner deletes the old
     project.
   - Or the new owner makes a paid Pro team and invites the current owner, who transfers the project there. Then
     check **Settings → Environment Variables**, **Settings → Domains** and **Settings → Git**.
5. **Domain.** If there's a custom address, move its registrar account too, or make sure the new team can reach
   whoever manages its DNS.
6. **Remove the old owner** from GitHub, Vercel and Supabase once everything works. After a transfer, GitHub keeps
   them as a collaborator.

Only the current owner can start a transfer, and the new owner has to let them in first, as each step says.

**Public or private code.** On Vercel's free Hobby plan, a private repository deploys only commits whose author is
the Vercel account owner. Commits by anyone else are blocked, and so are previews of their pull requests. A private
repository in a GitHub organization doesn't deploy on Hobby at all. GitHub's free plan also protects `main` only in
public repositories (see [CONTRIBUTING.md](CONTRIBUTING.md)). So choose one:

- Keep the repository public while others help.
- Keep it private, and have the owner merge every pull request with **Create a merge commit**. A squash or rebase
  merge keeps the helper as the author, and Vercel blocks it.
- Move to a paid Vercel Pro team. Each helper whose commits deploy needs a paid seat.

People's data is never in the repository, only the code.

## 3. Passing it to new volunteers in the same community

1. **Admins.** A current admin adds the new people in **Dashboard → People & roles**, with the role each needs. It
   works before they've signed in. Keep at least two admins. The database won't remove the last one.
2. **Step down.** Once the new admins have signed in, remove the roles of everyone who is leaving in **People &
   roles**. Start with Admin and Kitchen staff: they see names next to allergies.
3. **Accounts.** Add the new people to GitHub and Supabase, or move the accounts to them as in section 2. Then remove
   the people who are leaving: anyone in the Supabase project can read every table, dietary details included.
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
- **Backups.** Supabase Pro keeps daily backups for 7 days (see the cost table in [SETUP.md](SETUP.md)). The Free
  plan has none, so move to Pro before students rely on the site, as [docs/SCALING.md](docs/SCALING.md) says. Don't
  keep copies of people's data outside the app.
- **Restore.** Supabase → the project → **Database → Backups** → pick a day → **Restore**. The whole database goes
  back to that day, so anything since then is lost; tell the organizers first.
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
