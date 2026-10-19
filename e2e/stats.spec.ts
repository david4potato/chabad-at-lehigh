import { expect, test, type Locator } from "@playwright/test";
import { SITE } from "../src/config/site";
import { db, signInAs } from "./helpers";

// "Your activity" on the profile and "This semester" on the dashboard.
// Each test makes its own user and removes the rows it creates.

/** The number shown next to a stat label, e.g. stat(region, "Events") -> "1". */
function stat(region: Locator, label: string) {
  return region
    .getByRole("term")
    .filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) })
    .locator("xpath=following-sibling::dd[1]");
}

const monthYear = (d: Date) =>
  new Intl.DateTimeFormat("en-US", { timeZone: SITE.timeZone, month: "long", year: "numeric" }).format(d);

test.describe("stats", () => {
  test("a student's profile counts a past event they went to", async ({ page }) => {
    const email = await signInAs(page, "student", { next: "/profile" });
    const activity = page.getByRole("region", { name: "Your activity" });
    await expect(activity.getByText("Your first event will show up here.")).toBeVisible();

    const stamp = Date.now();
    const slug = `e2e-stats-dinner-${stamp}`;
    const title = `E2E Stats Shabbat ${stamp}`;
    const [event] = await db<{ id: string; starts_at: Date }>(
      `insert into public.events (slug, title, category, status, starts_at, ends_at)
       values ($1, $2, 'shabbat_dinner', 'published', now() - interval '2 days', now() - interval '2 days' + interval '2 hours')
       returning id, starts_at`,
      [slug, title],
    );
    try {
      await db(
        `insert into public.rsvps (event_id, user_id, status)
         select $1, id, 'going' from public.profiles where email = lower($2)`,
        [event.id, email],
      );

      await page.goto("/profile");
      await expect(stat(activity, "Events")).toHaveText("1");
      await expect(stat(activity, "Shabbat dinners")).toHaveText("1");
      await expect(stat(activity, "Times helped")).toHaveText("0");
      await expect(activity.getByText(`Coming since ${monthYear(new Date(event.starts_at))}`, { exact: true })).toBeVisible();
      await expect(activity.getByText(/^Last time:/)).toBeVisible();
      await expect(activity.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", `/events/${slug}`);
      await expect(activity.getByText("Your first event will show up here.")).toHaveCount(0);
    } finally {
      await db(`delete from public.events where id = $1`, [event.id]);
    }
  });

  test("organizers see this semester's numbers on the Overview", async ({ page }) => {
    await signInAs(page, "organizer", { next: "/admin" });
    const semester = page.getByRole("region", { name: "This semester" });
    await expect(semester.getByRole("heading", { name: "This semester", level: 2 })).toBeVisible();
    for (const label of ["Events held", "Shabbat dinners", "People who came", "New faces", "Avg. at Shabbat", "Volunteer sign-ups"]) {
      await expect(stat(semester, label)).toHaveText(/^\d+$/);
    }
    // The rest of the Overview is still there.
    await expect(page.getByRole("link", { name: "Read the quick guide" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Upcoming events", exact: true })).toBeVisible();
  });

  test("kitchen staff don't get the semester numbers", async ({ page }) => {
    await signInAs(page, "kitchen_staff", { next: "/admin" });
    await expect(page.getByRole("heading", { name: "Upcoming events", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "This semester" })).toHaveCount(0);
  });
});
