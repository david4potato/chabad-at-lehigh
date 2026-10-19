# Hand-off

How to pass this app on: to new volunteers in the same community, or to another community that wants its own
copy. Either way, nobody needs the original builder.

## 1. Accounts and costs

| Account | What it's for |
| --- | --- |
| GitHub | The code, and the checks that run on every change |
| Vercel | The website |
| Supabase | The database and sign-in |
| An email sender (Resend, or Gmail to start) | Sign-in emails |
| A domain (optional) | Your own web address |

The cost table near the top of [SETUP.md](SETUP.md) shows what each costs. Create every account with an address
your community controls, not one person's, and give at least two people access.

## 2. Passing it to new volunteers in the same community

1. **Admins.** A current admin adds the new people in **Dashboard → People & roles**, with the role each needs. It
   works before they've signed in. Keep at least two admins: the database refuses to remove the last one.
2. **Step down.** Once the new admins have signed in, remove the old admins' roles in **People & roles**.
3. **Accounts.** Add the new people to the GitHub repository, the Vercel project and the Supabase project, or move
   each one to an account or organization they control. GitHub, Vercel and Supabase each have a transfer option
   in the project's settings.
4. **Contacts.** Update the contact name, email and phone in **Dashboard → Settings**. The phone is shown as the
   allergy contact.

## 3. Starting a copy for another community

Follow [docs/REPLICATE.md](docs/REPLICATE.md). In short:

1. Ask the repository owner for permission first: there is no license yet.
2. Edit `src/config/site.ts` (names, campus, time zone), then replace the starting values in **Dashboard →
   Settings** after your first sign-in (organization name, contacts, address, parking, student email domains).
3. Use your own name, icons and colors. Never reuse the original community's name or marks, and never present your
   copy as theirs.
4. Set it up with your own accounts using [SETUP.md](SETUP.md).

One shared site for many communities isn't built yet. [docs/SCALING.md](docs/SCALING.md) explains when it would
be worth building.

## 4. Data

- **Nothing carries over.** A new copy starts with an empty database: no people, RSVPs, dietary details or
  history. Never copy people's data from one copy to another.
- **Demo content.** `supabase/seed.sql` holds **[DEMO]** events and dishes for trying things out. If you load it,
  remove it with **Remove demo content** in the **Getting started** checklist before you share the site.
- **Exports.** Each event's **Attendees** tab has **Download spreadsheet (CSV)**, without dietary data. A Supabase
  project owner can also export tables from the Supabase dashboard. Dietary details stay inside the app and its
  audited report.
- **Backups.** The Supabase Pro plan keeps daily backups (see [SETUP.md](SETUP.md)). On the free plan, export what
  you need to keep.
- **People leaving.** Anyone can delete their dietary details or their whole account in **Profile & settings**.

## 5. Updating safely

- Changes go through a branch and a pull request, and CI checks them before they reach `main`
  ([CONTRIBUTING.md](CONTRIBUTING.md)). A merge to `main` updates the live site.
- Database changes are new files in `supabase/migrations/`. Run only the new ones, in order: "Later database
  changes" at the end of [SETUP.md](SETUP.md).
- A copy pulls updates from this repository as in "Getting updates later" in [docs/REPLICATE.md](docs/REPLICATE.md).

## 6. Check that it works

1. Go through "Part G — Check it works" in [SETUP.md](SETUP.md) on a phone and a computer.
2. Every field in **Dashboard → Settings** is yours, including the allergy contact phone.
3. `/privacy` and `/meal-safety` match how your community really handles information and food.
4. Your organizers and whoever cooks sign off [docs/ORGANIZER_REVIEW.md](docs/ORGANIZER_REVIEW.md).
5. Hold one trial meal before you announce the site.
