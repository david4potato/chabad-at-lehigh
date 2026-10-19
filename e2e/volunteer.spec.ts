import { expect, test, type Page } from "@playwright/test";
import { SITE } from "../src/config/site";
import { db, signInAs } from "./helpers";

// "Help out" volunteer sign-ups. Each test makes its own user and removes the
// rows it creates, so the order and the mobile/desktop runs don't matter.

/** Same wording as the shift card: "3 of 4 spots left", or "4 of 4 spots taken" when full. */
function spotsText(left: number, slots: number) {
  const noun = slots === 1 ? "spot" : "spots";
  return left <= 0 ? `${slots} of ${slots} ${noun} taken` : `${left} of ${slots} ${noun} left`;
}

/** A datetime-local value N days from now in site time, e.g. "2026-10-20T14:00". */
function siteLocal(daysAhead: number, hhmm: string) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: SITE.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000));
  return `${day}T${hhmm}`;
}

/** The shift card (list item) whose heading is exactly `title`. */
function shiftCard(page: Page, title: string, within = page.locator("main")) {
  return within.getByRole("listitem").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

test.describe("help out", () => {
  test("a student signs up for a demo shift, sees the count go down, then cancels", async ({ page }) => {
    // An open demo shift that hasn't started and still has room.
    const rows = await db<{ id: string; title: string; slots: number; taken: number }>(
      `select s.id, s.title, s.slots, (select count(*)::int from public.volunteer_signups v where v.shift_id = s.id) as taken
       from public.volunteer_shifts s
       left join public.events e on e.id = s.event_id
       where s.is_demo and s.status = 'open' and s.starts_at > now() + interval '30 minutes'
         and (s.event_id is null or (e.status = 'published' and e.visibility = 'public'))
         and (select count(*) from public.volunteer_signups v where v.shift_id = s.id) < s.slots
       order by s.starts_at
       limit 1`,
    );
    expect(rows.length).toBeGreaterThan(0);
    const shift = rows[0];
    const left = shift.slots - shift.taken;

    // Signed out: the card offers sign-in instead of a button.
    await page.goto("/volunteer");
    await expect(page.getByRole("heading", { name: "Help out", level: 1 })).toBeVisible();
    await expect(shiftCard(page, shift.title).getByRole("link", { name: "Sign in to help" })).toBeVisible();

    const email = await signInAs(page, "student", { next: "/volunteer" });
    try {
      const card = shiftCard(page, shift.title);
      await expect(card.getByText(spotsText(left, shift.slots), { exact: true })).toBeVisible();

      await card.getByRole("button", { name: "Sign up", exact: true }).click();
      await expect(card.getByText("You're signed up", { exact: true })).toBeVisible();
      await expect(card.getByText(spotsText(left - 1, shift.slots), { exact: true })).toBeVisible();

      const signed = await db(
        `select 1 from public.volunteer_signups v join public.profiles p on p.id = v.user_id
         where v.shift_id = $1 and p.email = $2`,
        [shift.id, email],
      );
      expect(signed).toHaveLength(1);

      await card.getByRole("button", { name: "Can't make it", exact: true }).click();
      await expect(card.getByRole("button", { name: "Sign up", exact: true })).toBeVisible();
      await expect(card.getByText(spotsText(left, shift.slots), { exact: true })).toBeVisible();
    } finally {
      await db(
        `delete from public.volunteer_signups where user_id in (select id from public.profiles where email = $1)`,
        [email],
      );
    }
  });

  test("an organizer creates a shift for an event and sees who signed up", async ({ page }) => {
    const title = `E2E help cook ${Date.now()}`;
    const events = await db<{ id: string; slug: string }>(
      `select id, slug from public.events
       where category = 'shabbat_dinner' and status = 'published' and visibility = 'public' and starts_at > now()
       order by starts_at limit 1`,
    );
    expect(events.length).toBeGreaterThan(0);
    const event = events[0];

    try {
      // "Add a volunteer shift" on the admin event page preselects the event.
      await signInAs(page, "organizer", { next: `/admin/events/${event.id}` });
      await page.getByRole("link", { name: "Add a volunteer shift" }).click();
      await expect(page).toHaveURL(new RegExp(`/admin/volunteers/new\\?event=${event.id}`));
      await expect(page.getByRole("combobox", { name: "Event", exact: true })).toHaveValue(event.id);

      await page.getByLabel("What's the job?").fill(title);
      await page.getByLabel("Starts").fill(siteLocal(3, "14:00"));
      await page.getByLabel("Ends").fill(siteLocal(3, "16:00"));
      await page.getByRole("spinbutton", { name: "Spots" }).fill("2");
      await page.getByLabel("Details").fill("Meet in the kitchen.");
      await page.getByRole("button", { name: "Create shift" }).click();

      await expect(page).toHaveURL(/\/admin\/volunteers\/[0-9a-f-]{36}\?saved=1/);
      await expect(page.getByText(/shift created\. people can sign up/i)).toBeVisible();
      await expect(page.getByRole("heading", { name: "Signed up (0 of 2)" })).toBeVisible();
      const editUrl = new URL(page.url()).pathname;

      // The organizer signs up from the event page's "Help out" section.
      await page.goto(`/events/${event.slug}`);
      const card = shiftCard(page, title, page.locator("#help-out"));
      await expect(card.getByText(spotsText(2, 2), { exact: true })).toBeVisible();
      await card.getByRole("button", { name: "Sign up", exact: true }).click();
      await expect(card.getByText("You're signed up", { exact: true })).toBeVisible();

      // Their name shows on the shift's edit page.
      await page.goto(editUrl);
      await expect(page.getByRole("heading", { name: "Signed up (1 of 2)" })).toBeVisible();
      await expect(page.getByRole("main").getByText("Test organizer", { exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Email everyone" })).toHaveAttribute("href", /^mailto:\?bcc=/);

      // And in the dashboard list.
      await page.goto("/admin/volunteers");
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    } finally {
      await db(`delete from public.volunteer_shifts where title = $1`, [title]);
    }
  });
});
