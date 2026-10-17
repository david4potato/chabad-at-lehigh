import { expect, test } from "@playwright/test";
import { db, firstShabbatSlug, getSignInCode, uniqueEmail } from "./helpers";

test.describe("students", () => {
  test("sign up, welcome, RSVP, change RSVP, see it in My Events", async ({ page }) => {
    const email = uniqueEmail("student", "lehigh.edu");
    const slug = await firstShabbatSlug();

    // Start from an RSVP button while signed out.
    await page.goto(`/events/${slug}`);
    await page.getByRole("link", { name: "Going", exact: true }).first().click();
    await expect(page).toHaveURL(/\/sign-in/);

    const started = Date.now();
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();
    await page.getByLabel("Sign-in code").fill(await getSignInCode(email, started));
    await page.getByRole("button", { name: /^sign in$/i }).click();

    // Welcome form, then the optional dietary step.
    await expect(page).toHaveURL(/\/welcome/);
    await page.getByLabel(/full name/i).fill("Dana Student");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: /any food allergies/i })).toBeVisible();
    await page.getByRole("link", { name: /skip for now/i }).click();

    // Back on the event, ready to confirm.
    await expect(page).toHaveURL(new RegExp(`/events/${slug}`));
    await expect(page.getByText(/tap going to confirm/i)).toBeVisible();
    await page.getByRole("button", { name: "Going", exact: true }).click();
    await expect(page.getByText(/you're going/i).first()).toBeVisible();

    await page.getByRole("button", { name: "Change RSVP" }).click();
    await page.getByRole("button", { name: "Not going", exact: true }).click();
    await expect(page.getByText(/you're not going/i).first()).toBeVisible();

    await page.getByRole("button", { name: "Change RSVP" }).click();
    await page.getByRole("button", { name: "Going", exact: true }).click();
    await expect(page.getByText(/you're going/i).first()).toBeVisible();

    await page.goto("/my-events");
    await expect(page.getByRole("link", { name: /shabbat dinner/i }).first()).toBeVisible();

    const rows = await db<{ status: string }>(
      `select r.status from rsvps r join profiles p on p.id = r.user_id join events e on e.id = r.event_id
       where p.email = $1 and e.slug = $2`,
      [email, slug],
    );
    expect(rows[0]?.status).toBe("going");

    // Sign out from Profile & settings
    await page.goto("/profile");
    await page.getByRole("main").getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("banner").getByRole("link", { name: "Sign in" })).toBeVisible();
  });

  test("saved allergies produce personal menu alerts (never a 'safe' label)", async ({ page }) => {
    const email = uniqueEmail("allergy", "lehigh.edu");
    const started = Date.now();
    await page.goto("/sign-in?next=/profile/dietary");
    await page.getByLabel("Email address").fill(email);
    await page.getByRole("button", { name: /email me a sign-in link/i }).click();
    await page.getByLabel("Sign-in code").fill(await getSignInCode(email, started));
    await page.getByRole("button", { name: /^sign in$/i }).click();
    await page.getByLabel(/full name/i).fill("Sam Sesame");
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("checkbox", { name: "Sesame seeds", exact: true }).check();
    await page.getByLabel("How serious?").selectOption("severe");
    await page.getByRole("button", { name: /save and continue/i }).click();
    await page.waitForURL((u) => !u.search.includes("welcome=1"));

    const slug = await firstShabbatSlug();
    await page.goto(`/events/${slug}#menu`);
    const alert = page.getByRole("alert").filter({ hasText: /heads up for your allergies/i });
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/contact the organizer/i);
    await expect(page.getByText(/you listed sesame seeds/i).first()).toBeVisible();

    // The dietary data is private: stored for this user only.
    const rows = await db<{ severity: string }>(
      `select ua.severity from user_allergens ua join profiles p on p.id = ua.user_id where p.email = $1`,
      [email],
    );
    expect(rows).toEqual([{ severity: "severe" }]);
  });
});
