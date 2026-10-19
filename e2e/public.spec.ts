import { expect, test } from "@playwright/test";
import { firstShabbatSlug } from "./helpers";

test.describe("public browsing (signed out)", () => {
  test("home shows the Shabbat dinner card with RSVP buttons", async ({ page }) => {
    await page.goto("/");
    const card = page.locator("section", { has: page.getByRole("heading", { name: /shabbat dinner/i, level: 2 }) });
    await expect(card).toBeVisible();
    await expect(card.getByRole("link", { name: "Going", exact: true })).toHaveAttribute("href", /\/sign-in\?next=/);
    await expect(card.getByRole("link", { name: "Not going", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /menu & allergens/i })).toBeVisible();
  });

  test("event page shows the menu, allergens and disclaimer before RSVP", async ({ page }) => {
    const slug = await firstShabbatSlug();
    await page.goto(`/events/${slug}`);
    const menu = page.locator("#menu");
    await expect(menu.getByRole("heading", { name: "Menu" })).toBeVisible();
    await expect(menu.getByText(/confirmed by our kitchen/i)).toBeVisible();
    // Sesame oil and sesame seeds are shown as separate allergens.
    await expect(menu.getByText("Sesame oil", { exact: true }).first()).toBeVisible();
    await expect(menu.getByText("Sesame seeds", { exact: true }).first()).toBeVisible();
    await expect(menu.getByText(/May contain \(cross-contact\)/).first()).toBeVisible();
    await expect(menu.getByRole("heading", { name: /about our food and allergies/i })).toBeVisible();
    await expect(menu.getByText(/not a guarantee/i).first()).toBeVisible();
    // Never claim food is safe.
    await expect(page.getByText(/allergen-free|guaranteed safe|is safe for/i)).toHaveCount(0);
  });

  test("link previews have a title, description and a 1200×630 image", async ({ page, request }) => {
    for (const path of ["/", `/events/${await firstShabbatSlug()}`]) {
      await page.goto(path);
      const meta = (selector: string) => page.locator(selector).first().getAttribute("content");
      expect(await meta('meta[property="og:title"]')).toBeTruthy();
      expect(await meta('meta[property="og:description"]')).toBeTruthy();
      expect(await meta('meta[property="og:image:width"]')).toBe("1200");
      expect(await meta('meta[property="og:image:height"]')).toBe("630");
      expect(await meta('meta[property="og:image:alt"]')).toBeTruthy();
      expect(await meta('meta[name="twitter:card"]')).toBe("summary_large_image");
      const image = await meta('meta[property="og:image"]');
      expect(image).toMatch(/^https?:\/\//); // absolute, through metadataBase
      const res = await request.get(new URL(image!).pathname);
      expect(res.status()).toBe(200);
      expect(res.headers()["content-type"]).toContain("image/png");
    }
  });

  test("calendar file downloads for a published event", async ({ request }) => {
    const slug = await firstShabbatSlug();
    const res = await request.get(`/events/${slug}/calendar.ics`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("text/calendar");
    expect(await res.text()).toContain("BEGIN:VEVENT");
  });

  test("private pages send visitors to sign in", async ({ page }) => {
    for (const path of ["/admin", "/my-events", "/profile/dietary"]) {
      await page.goto(path);
      expect(page.url()).toContain(`/sign-in?next=${encodeURIComponent(path)}`);
    }
  });

  test("footer links all lead to real pages", async ({ page }) => {
    await page.goto("/");
    const links = page.getByRole("navigation", { name: "Footer" }).getByRole("link");
    const hrefs = await links.evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")!));
    expect(hrefs.length).toBeGreaterThanOrEqual(6);
    for (const href of hrefs) {
      const res = await page.goto(href);
      expect(res?.status(), href).toBe(200);
      await expect(page.locator("h1").first()).toBeVisible();
    }
  });

  test("navigation fits the screen size", async ({ page, isMobile }) => {
    await page.goto("/events");
    const bottomNav = page.locator("nav.fixed");
    if (isMobile) {
      await expect(bottomNav).toBeVisible();
      await bottomNav.getByRole("link", { name: "Home" }).click();
      await expect(page).toHaveURL(/\/$/);
    } else {
      await expect(bottomNav).toBeHidden();
      await page.getByRole("banner").getByRole("link", { name: "Find Us" }).click();
      await expect(page.getByRole("heading", { name: "Find Us", level: 1 })).toBeVisible();
    }
  });
});
