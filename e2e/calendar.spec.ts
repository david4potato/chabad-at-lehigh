import { expect, test } from "@playwright/test";
import { SITE } from "../src/config/site";
import { db, signInAs } from "./helpers";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The next published Shabbat dinner with its calendar day in site time. */
async function nextShabbatDinner() {
  const rows = await db<{ slug: string; title: string; day: string }>(
    `select slug, title, to_char(starts_at at time zone $1, 'YYYY-MM-DD') as day
     from public.events
     where category = 'shabbat_dinner' and status = 'published' and starts_at > now()
     order by starts_at limit 1`,
    [SITE.timeZone],
  );
  expect(rows.length).toBeGreaterThan(0);
  return rows[0];
}

test.describe("calendar views", () => {
  test("month view shows the Shabbat dinner on its date and lists that day", async ({ page }) => {
    const dinner = await nextShabbatDinner();
    await page.goto(`/events?view=month&month=${dinner.day.slice(0, 7)}`);

    await expect(
      page.getByRole("navigation", { name: "Calendar view" }).getByRole("link", { name: "Month", exact: true }),
    ).toHaveAttribute("aria-current", "page");

    const dayLink = page.getByRole("table").locator(`a[href*="day=${dinner.day}"]`);
    await expect(dayLink).toBeVisible();
    await expect(dayLink).toHaveAccessibleName(new RegExp(escapeRegex(dinner.title)));

    await dayLink.click();
    await expect(page).toHaveURL(new RegExp(`day=${dinner.day}`));
    const dayList = page.locator("#day-events");
    await expect(dayList.locator(`a[href="/events/${dinner.slug}"]`)).toBeVisible();

    // Category chips keep the month view and the selected day.
    await page
      .getByRole("navigation", { name: "Filter by category" })
      .getByRole("link", { name: "Shabbat dinners", exact: true })
      .click();
    await expect(page).toHaveURL(/view=month/);
    await expect(page).toHaveURL(/category=shabbat_dinner/);
    await expect(page.locator("#day-events").locator(`a[href="/events/${dinner.slug}"]`)).toBeVisible();
  });

  test("month view fits a 360px screen", async ({ page }) => {
    const dinner = await nextShabbatDinner();
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`/events?view=month&month=${dinner.day.slice(0, 7)}&day=${dinner.day}`);
    await expect(page.getByRole("table")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("calendar feed lists public events only", async ({ request }) => {
    const res = await request.get("/events/calendar.ics");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    expect(res.headers()["cache-control"]).toContain("max-age=900");

    const body = await res.text();
    const lines = body.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain(`X-WR-CALNAME:${SITE.name}`);
    expect(lines.filter((l) => l === "BEGIN:VEVENT").length).toBeGreaterThan(0);

    // Drafts, cancelled and members-only events never appear.
    const hidden = await db<{ id: string }>(
      `select id from public.events where status <> 'published' or visibility <> 'public'`,
    );
    for (const { id } of hidden) expect(body).not.toContain(`UID:${id}@`);
  });

  test("events page offers calendar subscriptions", async ({ page }) => {
    await page.goto("/events");
    const subscribe = page.getByRole("region", { name: "Subscribe" });
    await expect(subscribe.getByRole("link", { name: "Apple / Outlook" })).toHaveAttribute(
      "href",
      /^webcal:\/\/.+\/events\/calendar\.ics$/,
    );
    await expect(subscribe.getByRole("link", { name: /Google Calendar/ })).toHaveAttribute(
      "href",
      /^https:\/\/calendar\.google\.com\/calendar\/r\?cid=webcal%3A%2F%2F/,
    );
  });

  test("My Events filters past events by category", async ({ page }) => {
    const email = await signInAs(page, "student");
    const slug = `e2e-past-dinner-${Date.now()}`;
    const title = `E2E Past Shabbat ${Date.now()}`;
    const [event] = await db<{ id: string }>(
      `insert into public.events (slug, title, category, status, starts_at, ends_at)
       values ($1, $2, 'shabbat_dinner', 'published', now() - interval '10 days', now() - interval '10 days' + interval '2 hours')
       returning id`,
      [slug, title],
    );
    try {
      await db(
        `insert into public.rsvps (event_id, user_id, status)
         select $1, id, 'going' from public.profiles where email = lower($2)`,
        [event.id, email],
      );

      await page.goto("/my-events");
      const past = page.getByRole("region", { name: "Past events", exact: true });
      await expect(past.getByText(/^Last time:/)).toBeVisible();
      await expect(past.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", `/events/${slug}`);

      const chips = past.getByRole("navigation", { name: "Filter past events" });
      for (const name of ["All", "Shabbat dinners", "Holidays", "Learning", "Social", "Volunteer"]) {
        await expect(chips.getByRole("link", { name, exact: true })).toBeVisible();
      }
      await expect(chips.getByRole("link", { name: "All", exact: true })).toHaveAttribute("aria-current", "page");

      await chips.getByRole("link", { name: "Holidays", exact: true }).click();
      await expect(page).toHaveURL(/past=holiday/);
      await expect(past.getByText("Nothing under Holidays yet")).toBeVisible();
      await expect(past.locator(`a[href="/events/${slug}"]`)).toHaveCount(1); // only the "Last time" link

      await chips.getByRole("link", { name: "Shabbat dinners", exact: true }).click();
      await expect(page).toHaveURL(/past=shabbat_dinner/);
      await expect(past.locator(`a[href="/events/${slug}"]`)).toHaveCount(2); // "Last time" + the card
    } finally {
      await db(`delete from public.events where id = $1`, [event.id]);
    }
  });
});
