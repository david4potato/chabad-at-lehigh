import { expect, test, type Locator } from "@playwright/test";
import { SITE } from "../src/config/site";
import { db, signIn, signInAs, signOut, studentDomain, uniqueEmail } from "./helpers";

// Person history on Dashboard → People & roles (admins only).
// Each test makes its own users and removes the rows it inserts.

/** The number shown next to a stat label, e.g. stat(region, "Events") -> "1". */
function stat(region: Locator, label: string) {
  return region
    .getByRole("term")
    .filter({ hasText: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) })
    .locator("xpath=following-sibling::dd[1]");
}

const zoned = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-US", { timeZone: SITE.timeZone, ...options });
// Matches the app: the year is added when the date isn't in the current year (site time).
const yearOf = (d: Date) => zoned({ year: "numeric" }).format(d);
const shortDate = (d: Date) =>
  zoned({ weekday: "short", month: "short", day: "numeric", ...(yearOf(d) !== yearOf(new Date()) ? { year: "numeric" } : {}) }).format(d);
const monthYear = (d: Date) => zoned({ month: "long", year: "numeric" }).format(d);

async function profileId(email: string): Promise<string> {
  const rows = await db<{ id: string }>(`select id from public.profiles where email = lower($1)`, [email]);
  expect(rows.length).toBe(1);
  return rows[0].id;
}

test.describe("people history", () => {
  test("an admin sees how often a student came and opens their history", async ({ page }) => {
    const stamp = Date.now();
    const name = `E2E Person ${stamp}`;
    const studentEmail = uniqueEmail("person", await studentDomain());
    await signIn(page, studentEmail, { name, newAccount: true });
    await signOut(page);
    const studentId = await profileId(studentEmail);

    const slug = `e2e-people-dinner-${stamp}`;
    const title = `E2E People Shabbat ${stamp}`;
    const [event] = await db<{ id: string; starts_at: Date }>(
      `insert into public.events (slug, title, category, status, starts_at, ends_at)
       values ($1, $2, 'shabbat_dinner', 'published', now() - interval '2 days', now() - interval '2 days' + interval '2 hours')
       returning id, starts_at`,
      [slug, title],
    );
    try {
      await db(`insert into public.rsvps (event_id, user_id, status) values ($1, $2, 'going')`, [event.id, studentId]);
      const startsAt = new Date(event.starts_at);

      // People & roles: the short activity line, and the name links to the person.
      await signInAs(page, "admin", { next: `/admin/people?q=${encodeURIComponent(studentEmail)}` });
      await expect(page.getByRole("heading", { name: "People & roles", level: 1 })).toBeVisible();
      const personLink = page.getByRole("link", { name, exact: true });
      const row = page.getByRole("listitem").filter({ has: personLink });
      await expect(row.getByText(`Came 1 time · last ${shortDate(startsAt)}`, { exact: true })).toBeVisible();
      await expect(row.getByRole("button", { name: "Remove Student role", exact: true })).toBeVisible();
      // The grant form is still on the page.
      await expect(page.getByRole("button", { name: "Give role", exact: true })).toBeVisible();

      await personLink.click();
      await expect(page).toHaveURL(new RegExp(`/admin/people/${studentId}$`));
      await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
      await expect(page.getByRole("link", { name: studentEmail, exact: true })).toHaveAttribute("href", `mailto:${studentEmail}`);
      await expect(page.getByText(SITE.campus.studentLabel, { exact: true })).toBeVisible();

      const roles = page.getByRole("region", { name: "Roles" });
      await expect(roles.getByRole("button", { name: "Remove Student role", exact: true })).toBeVisible();
      await expect(roles.getByRole("combobox", { name: "Add a role", exact: true })).toBeVisible();

      const activity = page.getByRole("region", { name: "Activity" });
      await expect(stat(activity, "Events")).toHaveText("1");
      await expect(stat(activity, "Shabbat dinners")).toHaveText("1");
      await expect(stat(activity, "Times helped")).toHaveText("0");
      await expect(activity.getByText(`Coming since ${monthYear(startsAt)}`, { exact: true })).toBeVisible();
      await expect(activity.getByText(`Last time: ${shortDate(startsAt)}`, { exact: true })).toBeVisible();

      const recent = page.getByRole("region", { name: "Recent events" });
      await expect(recent.getByRole("link", { name: title, exact: true })).toHaveAttribute("href", `/events/${slug}`);
      await expect(recent.getByText(`${shortDate(startsAt)} · Shabbat dinner`, { exact: true })).toBeVisible();

      await expect(page.getByRole("region", { name: "Upcoming RSVPs" }).getByText("No upcoming RSVPs.")).toBeVisible();
      await expect(page.getByRole("region", { name: "Volunteer shifts" }).getByText("Hasn't signed up to help yet.")).toBeVisible();

      // No dietary information on this page.
      await expect(page.getByRole("main").getByText(/dietary|allerg/i)).toHaveCount(0);

      await page.getByRole("link", { name: "Back to People & roles", exact: true }).click();
      await expect(page).toHaveURL(/\/admin\/people$/);

      // A made-up id is a friendly not-found page.
      await page.goto("/admin/people/not-a-person");
      await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
    } finally {
      await db(`delete from public.events where id = $1`, [event.id]);
    }
  });

  test("organizers can't open a person's history", async ({ page }) => {
    const email = await signInAs(page, "organizer");
    const id = await profileId(email);
    await page.goto(`/admin/people/${id}`);
    await expect(page).toHaveURL(/\/admin\?denied=1$/);
    await expect(page.getByRole("heading", { name: "Activity", exact: true })).toHaveCount(0);
  });
});
