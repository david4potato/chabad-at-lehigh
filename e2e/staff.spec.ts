import { expect, test } from "@playwright/test";
import { siteLocalToUtcIso } from "../src/lib/time";
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
    // 7:00 PM in site time (the conversion itself is unit-tested in src/lib/time.test.ts).
    expect(new Date(event.starts_at).toISOString()).toBe(siteLocalToUtcIso("2030-05-01T19:00"));

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
    // Typed but not saved on its own: Publish saves it too.
    const kitchenNote = "E2E: prepared in a shared kitchen that also handles sesame.";
    await page.getByLabel("Kitchen note (shown above the menu)").fill(kitchenNote);

    // The preparation confirmation is required before publishing.
    await page.getByRole("button", { name: /publish menu/i }).click();
    await expect(page.getByRole("heading", { name: /draft — version 1/i })).toBeVisible();
    await page.getByRole("checkbox", { name: /i confirm the ingredients/i }).check();
    await page.getByRole("button", { name: /publish menu/i }).click();
    await expect(page.getByText("Menu published.")).toBeVisible();
    const [live] = await db<{ kitchen_notes: string | null }>(
      `select kitchen_notes from menu_versions where event_id = $1 and status = 'published'`,
      [event.id],
    );
    expect(live.kitchen_notes).toBe(kitchenNote);

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

  test("organizer duplicates last week's dinner with its menu and shifts, then publishes it", async ({ page }) => {
    // Not a Shabbat dinner, so other tests that pick "the next Shabbat dinner" never see the copy.
    const title = `E2E Weekly Dinner ${Date.now()}`;
    const [source] = await db<{ id: string; starts_at: Date }>(
      `insert into events (slug, title, category, status, starts_at, ends_at, has_meal)
       values ($1, $2, 'social', 'published', now() - interval '2 days', now() - interval '2 days' + interval '2 hours', true)
       returning id, starts_at`,
      [`e2e-weekly-${Date.now()}`, title],
    );
    // Last week's menu (with a kitchen note and a cross-contact tick) and a help shift that filled up.
    await db(
      `with v as (insert into menu_versions (event_id, version, status, kitchen_notes) values ($1, 1, 'draft', 'E2E shared kitchen.') returning id),
            i as (insert into menu_items (menu_version_id, dish_id, course, sort_order)
                  select v.id, d.id, 'appetizer', 1 from v, dishes d where d.name = 'Hummus with tahini' returning id)
       insert into menu_item_cross_contact (menu_item_id, allergen_code) select id, 'tree_nuts' from i`,
      [source.id],
    );
    await db(
      `insert into volunteer_shifts (event_id, title, starts_at, slots, status)
       select id, 'E2E help cook', starts_at - interval '3 hours', 3, 'closed' from events where id = $1`,
      [source.id],
    );
    const cleanup = [source.id];

    try {
      // One tap from the Past tab.
      await signInAs(page, "organizer", { next: "/admin/events?tab=past" });
      await page.getByRole("listitem").filter({ hasText: title }).getByRole("button", { name: "Duplicate for next week" }).click();
      await expect(page).toHaveURL(/\/admin\/events\/[0-9a-f-]{36}\?duplicated=1/);
      const copyId = new URL(page.url()).pathname.split("/").pop()!;
      cleanup.push(copyId);
      await expect(page.getByText(/the menu came too.*volunteer shifts open when you publish/i)).toBeVisible();

      const [copy] = await db<{ status: string; starts_at: Date }>(`select status, starts_at from events where id = $1`, [copyId]);
      expect(copy.status).toBe("draft");
      // Same time one week later (an hour either way across a daylight-saving change).
      const days = (new Date(copy.starts_at).getTime() - new Date(source.starts_at).getTime()) / 86_400_000;
      expect(Math.abs(days - 7)).toBeLessThan(0.1);
      const shifts = await db<{ title: string; status: string }>(`select title, status from volunteer_shifts where event_id = $1`, [copyId]);
      expect(shifts).toEqual([{ title: "E2E help cook", status: "open" }]);
      const crossContact = await db<{ allergen_code: string }>(
        `select cc.allergen_code from menu_item_cross_contact cc
         join menu_items mi on mi.id = cc.menu_item_id join menu_versions v on v.id = mi.menu_version_id
         where v.event_id = $1 and v.status = 'draft'`,
        [copyId],
      );
      expect(crossContact).toEqual([{ allergen_code: "tree_nuts" }]);

      // "Publish" in the alert, then the next step is the menu, still a draft until staff confirm it.
      await page.getByRole("button", { name: "Publish", exact: true }).click();
      await page.getByRole("link", { name: /next: check the menu and publish it/i }).click();
      await expect(page.getByRole("heading", { name: /draft — version 1/i })).toBeVisible();
      await expect(page.getByRole("button", { name: "Remove Hummus with tahini" })).toBeVisible();
      await expect(page.getByLabel("Kitchen note (shown above the menu)")).toHaveValue("E2E shared kitchen.");
      const [published] = await db<{ status: string }>(`select status from events where id = $1`, [copyId]);
      expect(published.status).toBe("published");
    } finally {
      await db(`delete from events where id = any($1::uuid[])`, [cleanup]);
    }
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
