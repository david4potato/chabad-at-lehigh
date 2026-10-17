import { expect, test } from "@playwright/test";
import { db, signInAs, uniqueEmail } from "./helpers";

test.describe("admin panel", () => {
  test("admin sees the launch checklist, gives a role, updates settings and sees it in the audit log", async ({ page }) => {
    const future = uniqueEmail("future-organizer");
    const parking = `Street parking on Wyandotte Street (${Date.now()})`;
    try {
      await signInAs(page, "admin", { next: "/admin" });
      await expect(page.getByRole("heading", { name: "Getting started" })).toBeVisible();
      // The local database has DEMO content, so the in-app remove button is offered.
      await expect(page.getByRole("button", { name: "Remove demo content" })).toBeVisible();

      await page.goto("/admin/people");
      await page.getByRole("textbox", { name: "Email", exact: true }).fill(future);
      await page.getByRole("combobox", { name: "Role", exact: true }).selectOption("organizer");
      await page.getByRole("button", { name: "Give role" }).click();
      await expect(page.getByText(/hasn't signed in yet/i)).toBeVisible();

      await page.goto("/admin/settings");
      await page.getByLabel("Parking").fill(parking);
      await page.getByRole("button", { name: "Save settings" }).click();
      await expect(page.getByText("Settings saved.")).toBeVisible();

      await page.goto("/find-us");
      await expect(page.getByText(parking)).toBeVisible();

      await page.goto("/admin/audit");
      await expect(page.getByText("Settings changed").first()).toBeVisible();
    } finally {
      await db(`delete from public.pending_role_grants where email = $1`, [future]);
      await db(
        `update public.app_settings set value = value || '{"parking": ""}'::jsonb, updated_by = null where key = 'organization'`,
      );
    }
  });

  test("organizers don't get admin-only sections", async ({ page }) => {
    await signInAs(page, "organizer", { next: "/admin" });
    const nav = page.getByRole("navigation", { name: "Dashboard sections" });
    await expect(nav.getByRole("link", { name: "Events" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "People & roles" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Settings" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Getting started" })).toHaveCount(0);

    await page.goto("/admin/settings");
    await expect(page).not.toHaveURL(/\/admin\/settings/);
  });
});
