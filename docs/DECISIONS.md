# Decisions

Choices made about this app, why, and how to change them. Newest first within each section.

Some were made by helpers working for the repository owner, David, under the delegation he gave on
19 October 2026. Those are marked **decided under David's 19 Oct delegation (he can change it)**. Anything
that affects Chabad at Lehigh itself also needs the directors, and is marked when they haven't confirmed it yet.

These always stay with David: approving a production deploy, sending any message outside this repository,
signing or paying for anything, creating accounts, repositories or domains, and legal filings.

## Decided

### Hidden from search engines until launch

- **When:** 19 October 2026
- **What:** `listInSearchEngines: false` in [src/config/site.ts](../src/config/site.ts) asks search engines not to
  list any page.
- **Why:** The directors haven't signed off yet, and anyone with the address can open the site. Their name
  shouldn't show up in search results before they say yes.
- **To change:** set it to `true` at launch ([SETUP.md](../SETUP.md), "At launch"), only after the directors sign off.
- **Status:** decided under David's 19 Oct delegation (he can change it).

### Directors first, students last

- **What:** the first live site is for the directors only. They review it
  ([ORGANIZER_REVIEW.md](ORGANIZER_REVIEW.md)), run a trial dinner and sign off in writing. Only then do students
  hear about it.
- **Why:** they run the dinners and answer for the food. Nobody should rely on the app before they have.
- **Status:** decided by David (Project OS decisions register, ow-07).

### One copy per community

- **When:** 19 October 2026
- **What:** another community runs its own copy: its own code, database, website and sign-in emails
  ([REPLICATE.md](REPLICATE.md)). There is no shared site for many communities.
- **Why:** each community keeps its own private dietary data, and nothing one does can affect another. One shared
  site is a large database change, and a mistake in one rule could show one community's data to another.
  [SCALING.md](SCALING.md) says when to revisit this.
- **Status:** decided under David's 19 Oct delegation (he can change it).

### Five fixed roles

- **What:** student, community guest, organizer, kitchen staff and admin. They are checked in the database and
  mirrored in [src/lib/roles.ts](../src/lib/roles.ts). There are no custom roles and no admins limited to one area.
- **Why:** one small community needs nothing more, and fewer roles means fewer ways to show dietary data to the
  wrong person. [SCALING.md](SCALING.md) lists what a new role would take.
- **Status:** decided under David's 19 Oct delegation (he can change it). Project OS register: pp-26.

### No license yet

- **What:** the repository has no license, so nobody may reuse the code without the owner's permission
  ([REPLICATE.md](REPLICATE.md)). If David and the directors agree to open it, the default is the MIT license for
  the code. Chabad's name, logo and marks are never licensed.
- **Why:** the code was built for Chabad at Lehigh. Whether others may copy it is their call as much as David's.
- **Status:** the default is decided under David's 19 Oct delegation (he can change it). Adding a license needs
  David and the directors.

### The repository is public for now

- **What:** the code is on a public GitHub repository. People's data is never in it, only the code.
- **Why:** on Vercel's free plan a private repository deploys only the owner's own commits, and GitHub's free plan
  protects `main` only in public repositories ([HANDOFF.md](../HANDOFF.md), "Public or private code").
- **What it means:** anyone can see that this app names Chabad at Lehigh. Search engines are asked not to list the
  site (above), and the first message to the directors says the code is public.
- **Status:** decided under David's 19 Oct delegation (he can change it). The directors haven't confirmed it yet.
  If they want it private, follow "Public or private code" in HANDOFF.md.

### How changes are merged

- **What:** every change goes through a pull request. It is merged only when every check passes and there are no
  conflicts, with **Create a merge commit**, not squash or rebase. Changes to the live database, production deploys
  and the database efficiency work wait for David.
- **Why:** checks catch mistakes before they reach `main`. If the repository becomes private on Vercel's free plan,
  a merge commit made by the owner still deploys. A squash or rebase keeps the helper as the author, and Vercel
  blocks it.
- **Status:** David asked helpers to merge on their own once checks pass. The merge method is decided under David's
  19 Oct delegation (he can change it).

## Open: needs the directors

- **The web address.** A new domain is an option for the directors, not a decision. Until they choose, the site
  uses its free `vercel.app` address.
- **Who gets which role.** The directors name the admins and the kitchen staff.
- **Launch date.** After the review, the trial dinner and written sign-off (above).
- **Public or private code**, and **a license** (above).

## Written down elsewhere

- The rules the product never breaks: [PHILOSOPHY.md](PHILOSOPHY.md).
- Stack, data access and safety rules for anyone changing the code: [CLAUDE.md](../CLAUDE.md).
- Handing over accounts: [HANDOFF.md](../HANDOFF.md).
