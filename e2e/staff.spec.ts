import { expect, test } from "@playwright/test";
import { db, signInAs } from "./helpers";

test.describe("organizer dashboard", () => {
  test("students cannot open the dashboard", async ({ page }) => {
    await signInAs(page, "student");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/\?denied=1/);
    await expect(page.getByText(/only for organizers/i)).toBeVisible();
  });

  test("organizer creates and publishes an event, then manages attendees", async ({ page }) => {
    await signInAs(page, "organizer", { next: "/admin/events/new" });
    const title = `E2E Learning Night ${Date.now()}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Category").selectOption("learning");
    await page.getByLabel("Status").selectOption("published");
    await page.getByLabel("Starts").fill("2030-05-01T19:00");
    await page.getByLabel("Capacity").fill("1");
    await page.getByRole("button", { name: "Create event" }).click();
    await expect(page.getByText(/event created/i)).toBeVisible();

    const [event] = await db<{ id: string; slug: string; starts_at: Date }>(`select id, slug, starts_at from events where title = $1`, [title]);
    // 7:00 PM in Bethlehem (EDT) is 23:00 UTC.
    expect(new Date(event.starts_at).toISOString()).toBe("2030-05-01T23:00:00.000Z");

    await page.goto(`/events/${event.slug}`);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();

    await page.goto(`/admin/events/${event.id}/attendees`);
    await expect(page.getByRole("tab", { name: /^going/i })).toBeVisible();
    await expect(page.getByText("Seats taken")).toBeVisible();
  });

  test("kitchen staff publish a menu only after confirming preparation; urgent updates notify attendees", async ({ page, browser }) => {
    // A fresh event with a meal, and a student who is going.
    const slug = `e2e-lunch-${Date.now()}`;
    const [event] = await db<{ id: string }>(
      `insert into events (slug, title, status, starts_at, has_meal) values ($1, 'E2E Lunch', 'published', now() + interval '5 days', true) returning id`,
      [slug],
    );
    const studentPage = await browser.newPage();
    const studentEmail = await signInAs(studentPage, "student");
    await db(`insert into rsvps (event_id, user_id, status) select $1, id, 'going' from profiles where email = $2`, [event.id, studentEmail]);

    await signInAs(page, "kitchen_staff", { next: `/admin/events/${event.id}/menu` });
    await page.getByRole("button", { name: /start the menu/i }).click();
    await expect(page.getByRole("heading", { name: /draft — version 1/i })).toBeVisible();
    await page.getByLabel("Add a dish").selectOption({ label: "Hummus with tahini" });
    await page.getByRole("button", { name: "Add to menu" }).click();
    await expect(page.getByText("Dish added.")).toBeVisible();

    // The preparation confirmation is required before publishing.
    await page.getByRole("button", { name: /publish menu/i }).click();
    await expect(page.getByRole("heading", { name: /draft — version 1/i })).toBeVisible();
    await page.getByRole("checkbox", { name: /i confirm the ingredients/i }).check();
    await page.getByRole("button", { name: /publish menu/i }).click();
    await expect(page.getByText("Menu published.")).toBeVisible();

    await page.getByLabel("Message").fill("E2E: the hummus now contains pine nuts.");
    await page.getByRole("checkbox", { name: /urgent — notify everyone/i }).check();
    await page.getByRole("button", { name: "Post update" }).click();
    await expect(page.getByText(/everyone who rsvp'd has been notified/i)).toBeVisible();

    await studentPage.goto(`/events/${slug}#menu`);
    await expect(studentPage.locator("#menu").getByText("Hummus with tahini")).toBeVisible();
    await expect(studentPage.getByText(/hummus now contains pine nuts/i).first()).toBeVisible();
    await studentPage.goto("/notifications");
    await expect(studentPage.getByText(/urgent menu update/i).first()).toBeVisible();
    await studentPage.close();
  });

  test("organizers see anonymous dietary counts; kitchen staff see names", async ({ page, browser }) => {
    const [shabbat] = await db<{ id: string }>(
      `select id from events where category = 'shabbat_dinner' and status = 'published' and starts_at > now() order by starts_at limit 1`,
    );
    await signInAs(page, "organizer", { next: `/admin/events/${shabbat.id}/dietary` });
    await expect(page.getByRole("heading", { name: /summary \(no names\)/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "By person" })).toHaveCount(0);
    await expect(page.getByText(/visible only to kitchen staff and admins/i)).toBeVisible();

    const kitchen = await browser.newPage();
    await signInAs(kitchen, "kitchen_staff", { next: `/admin/events/${shabbat.id}/dietary` });
    await expect(kitchen.getByRole("heading", { name: "By person" })).toBeVisible();
    await kitchen.close();

    const logged = await db<{ n: number }>(
      `select count(*)::int as n from audit_events where action = 'dietary_report.viewed' and entity_id = $1`,
      [shabbat.id],
    );
    expect(logged[0].n).toBeGreaterThan(0);
  });
});

test.describe("invitations and help", () => {
  test("organizer invites a member, who sees the invitation; help guide is available", async ({ page, browser }) => {
    const member = await browser.newPage();
    const memberEmail = await signInAs(member, "student");
    const [event] = await db<{ id: string; slug: string; title: string }>(
      `select id, slug, title from events where slug like 'demo-study-break%' limit 1`,
    );

    await signInAs(page, "organizer", { next: `/admin/events/${event.id}/attendees` });
    await page.getByLabel("Email addresses").fill(`${memberEmail}, nobody-${Date.now()}@example.com, oops`);
    await page.getByLabel("Personal message (optional)").fill("Come play board games!");
    await page.getByRole("button", { name: "Send invitations" }).click();
    await expect(page.getByText("1 person invited.")).toBeVisible();
    await expect(page.getByText(/no account yet/i)).toBeVisible();
    await expect(page.getByText(/not a valid email/i)).toBeVisible();

    await member.goto("/notifications");
    await expect(member.getByText(`You're invited: ${event.title}`)).toBeVisible();
    await expect(member.getByText("Come play board games!")).toBeVisible();
    await member.getByRole("link", { name: /view details/i }).first().click();
    await expect(member).toHaveURL(new RegExp(`/events/${event.slug}`));
    await expect(member.getByRole("button", { name: /invite friends/i })).toBeVisible();
    await member.close();

    await page.goto("/admin");
    await page.getByRole("link", { name: "Read the quick guide" }).click();
    await expect(page.getByRole("heading", { name: "How to use the dashboard" })).toBeVisible();
    await expect(page.getByText(/your weekly shabbat dinner routine/i).first()).toBeVisible();
  });
});
