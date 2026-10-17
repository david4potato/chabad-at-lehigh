import { expect, test } from "@playwright/test";
import { db, signInAs } from "./helpers";

test.describe("account settings", () => {
  test("edit profile, use the account menu, clear notifications, delete dietary info, delete account", async ({ page, isMobile }) => {
    const email = await signInAs(page, "student", { next: "/profile" });

    // Profile & settings: edit details
    await expect(page.getByText("Profile & settings").first()).toBeVisible();
    await page.getByLabel("Full name").fill("Rivka Settings");
    await page.getByLabel("What should we call you?").fill("Rivka");
    await page.getByRole("radio", { name: "Alumni" }).check();
    await page.getByLabel("Class year").fill("2024");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByText("Your profile is saved.")).toBeVisible();
    const [profile] = await db<{ full_name: string; preferred_name: string; affiliation: string; class_year: number }>(
      `select full_name, preferred_name, affiliation, class_year from profiles where email = $1`,
      [email],
    );
    expect(profile).toEqual({ full_name: "Rivka Settings", preferred_name: "Rivka", affiliation: "alumni", class_year: 2024 });

    // Account menu (desktop header) lists the account pages
    if (!isMobile) {
      await page.getByRole("button", { name: /account menu/i }).click();
      for (const name of ["Profile & settings", "Dietary & allergies", "Notifications"]) {
        await expect(page.getByRole("group", { name: "Account" }).getByRole("link", { name })).toBeVisible();
      }
      await expect(page.getByRole("group", { name: "Account" }).getByRole("button", { name: "Sign out" })).toBeVisible();
      await page.keyboard.press("Escape");
    }

    // Notifications: the bell shows the unread count and clears after viewing
    await db(
      `insert into notifications (user_id, kind, title, body, link)
       select id, 'test', 'Test notification', 'Hello from the test', '/events' from profiles where email = $1`,
      [email],
    );
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Notifications, 1 unread" })).toBeVisible();
    await page.goto("/notifications");
    await expect(page.getByText("Test notification")).toBeVisible();
    await expect(page.getByRole("link", { name: "Notifications", exact: true })).toBeVisible({ timeout: 10_000 });

    // Dietary info: save, then delete
    await page.goto("/profile/dietary");
    await page.getByRole("checkbox", { name: "Peanuts", exact: true }).check();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/^Saved\./)).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "Delete my dietary information" }).click();
    await page.getByRole("button", { name: "Yes, delete it" }).click();
    await expect(page.getByText("Your dietary information has been deleted.")).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Peanuts", exact: true })).not.toBeChecked();
    const allergens = await db(`select 1 from user_allergens ua join profiles p on p.id = ua.user_id where p.email = $1`, [email]);
    expect(allergens).toHaveLength(0);

    // Delete account (requires typing DELETE)
    await page.goto("/profile");
    await page.getByRole("button", { name: "Delete my account" }).click();
    const confirm = page.getByRole("button", { name: "Delete my account" });
    await expect(confirm).toBeDisabled();
    await page.getByLabel('Type "DELETE" to confirm').fill("delete");
    await confirm.click();
    await expect(page).toHaveURL(/account_deleted=1/);
    await expect(page.getByText(/your account and its information have been deleted/i)).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
    expect(await db(`select 1 from profiles where email = $1`, [email])).toHaveLength(0);
  });
});
