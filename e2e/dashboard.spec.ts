import { expect, test } from "@playwright/test";
import { db, firstShabbatSlug, signInAs } from "./helpers";

// Every dashboard page, opened as each role. The rules mirror requireRole on each page:
// allowed roles get the page (no error screen, no browser errors), other staff are sent
// to /admin?denied=1 and students to /?denied=1.

type Staff = "organizer" | "kitchen_staff" | "admin";
const ALL: Staff[] = ["organizer", "kitchen_staff", "admin"];
const ORGANIZERS: Staff[] = ["organizer", "admin"];
const ADMINS: Staff[] = ["admin"];

type DashboardPage = { path: string; allowed: Staff[]; landsOn?: Partial<Record<Staff, string>> };

async function dashboardPages(): Promise<DashboardPage[]> {
  const slug = await firstShabbatSlug();
  const [event] = await db<{ id: string }>(`select id from public.events where slug = $1`, [slug]);
  const [dish] = await db<{ id: string }>(`select id from public.dishes order by created_at limit 1`);
  const [shift] = await db<{ id: string }>(`select id from public.volunteer_shifts order by starts_at limit 1`);
  const [person] = await db<{ id: string }>(`select id from public.profiles order by created_at limit 1`);
  const e = `/admin/events/${event.id}`;
  return [
    { path: "/admin", allowed: ALL },
    { path: "/admin/help", allowed: ALL },
    { path: "/admin/events", allowed: ALL },
    { path: "/admin/events/new", allowed: ORGANIZERS },
    // Kitchen staff manage the menu, so the event page sends them there.
    { path: e, allowed: ALL, landsOn: { kitchen_staff: `${e}/menu` } },
    { path: `${e}/attendees`, allowed: ORGANIZERS },
    { path: `${e}/menu`, allowed: ALL },
    { path: `${e}/dietary`, allowed: ALL },
    { path: "/admin/dishes", allowed: ALL },
    { path: "/admin/dishes/new", allowed: ALL },
    { path: `/admin/dishes/${dish.id}`, allowed: ALL },
    { path: "/admin/ingredients", allowed: ALL },
    { path: "/admin/suggestions", allowed: ALL },
    { path: "/admin/announcements", allowed: ORGANIZERS },
    { path: "/admin/volunteers", allowed: ORGANIZERS },
    { path: "/admin/volunteers/new", allowed: ORGANIZERS },
    { path: `/admin/volunteers/${shift.id}`, allowed: ORGANIZERS },
    { path: "/admin/people", allowed: ADMINS },
    { path: `/admin/people/${person.id}`, allowed: ADMINS },
    { path: "/admin/settings", allowed: ADMINS },
    { path: "/admin/audit", allowed: ADMINS },
  ];
}

const endsWith = (path: string) => new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

test.describe("dashboard pages for each role", () => {
  for (const role of ["admin", "organizer", "kitchen_staff"] as const) {
    test(`${role}: every dashboard page opens, or turns them away`, async ({ page }) => {
      test.setTimeout(120_000);
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(`${page.url()}: ${err.message}`));
      await signInAs(page, role);

      for (const p of await dashboardPages()) {
        await page.goto(p.path);
        if (p.allowed.includes(role)) {
          await expect(page, p.path).toHaveURL(endsWith(p.landsOn?.[role] ?? p.path));
          await expect(page.getByRole("heading", { level: 1 }).first(), p.path).toBeVisible();
          await expect(page.getByRole("heading", { name: "Something went wrong" }), p.path).toHaveCount(0);
        } else {
          await expect(page, p.path).toHaveURL(/\/admin\?denied=1$/);
        }
      }
      expect(errors).toEqual([]);
    });
  }

  test("students are turned away from every dashboard page", async ({ page }) => {
    test.setTimeout(120_000);
    await signInAs(page, "student");
    for (const p of await dashboardPages()) {
      await page.goto(p.path);
      await expect(page, p.path).toHaveURL(/\/\?denied=1$/);
    }
  });
});
