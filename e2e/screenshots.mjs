// Dev tool (not a test): captures every main page at phone and desktop sizes
// for visitor / student / organizer / kitchen / admin, for design review.
// Usage: node e2e/screenshots.mjs <outDir> [baseUrl]
// Requires the app running (next start) and the local Supabase stack.
import { chromium } from "playwright-core";
import pg from "pg";
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] ?? "screenshots";
const BASE = process.argv[3] ?? "http://localhost:3100";
const MAIL = "http://127.0.0.1:54324";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const EXEC = process.env.PW_CHROMIUM_PATH;
fs.mkdirSync(OUT, { recursive: true });

async function q(sql, params = []) {
  const c = new pg.Client({ connectionString: DB });
  await c.connect();
  try { return (await c.query(sql, params)).rows; } finally { await c.end(); }
}
async function code(email, after) {
  for (let i = 0; i < 40; i++) {
    const j = await (await fetch(`${MAIL}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`)).json();
    const m = (j.messages ?? []).find((x) => new Date(x.Created).getTime() >= after - 2000);
    if (m) {
      const t = (await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json()).Text;
      const r = /code in the app:\W*(\d{6,10})/i.exec(t);
      if (r) return r[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no code for " + email);
}
async function signIn(page, email, name) {
  const t = Date.now();
  await page.goto(`${BASE}/sign-in`);
  await page.fill("#email", email);
  await page.click("button[type=submit]");
  await page.waitForSelector("#code");
  await page.fill("#code", await code(email, t));
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/sign-in"), { timeout: 20000 });
  // Skip the welcome form for screenshots (the E2E tests cover it).
  await q(`update public.profiles set full_name=$2, onboarded_at=now() where email=$1`, [email, name]);
}

const shabbat = (await q(`select id, slug from events where category='shabbat_dinner' and status='published' and starts_at > now() order by starts_at limit 1`))[0];
const lunch = (await q(`select id, slug from events where slug like 'demo-lunch%' limit 1`))[0];
const dish = (await q(`select id from dishes order by name limit 1`))[0];

const PUBLIC = ["/", "/events", `/events/${shabbat.slug}`, "/announcements", "/find-us", "/meal-safety", "/coming-soon", "/privacy", "/sign-in", "/this-page-does-not-exist"];
const MEMBER = ["/", `/events/${shabbat.slug}`, "/my-events", "/profile", "/profile/dietary", "/notifications", "/welcome"];
const ORGANIZER = ["/admin", "/admin/events", "/admin/events/new", `/admin/events/${shabbat.id}`, `/admin/events/${shabbat.id}/attendees`, `/admin/events/${shabbat.id}/menu`, `/admin/events/${shabbat.id}/dietary`, "/admin/announcements", "/admin/suggestions", "/admin/dishes"];
const KITCHEN = [`/admin/events/${shabbat.id}/dietary`, `/admin/events/${lunch.id}/menu`, `/admin/dishes/${dish.id}`, "/admin/ingredients"];
const ADMIN = ["/admin/people", "/admin/settings", "/admin/audit"];

const browser = await chromium.launch({ executablePath: EXEC, headless: true });
const viewports = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 900 } };

async function capture(ctx, who, paths) {
  const page = await ctx.newPage();
  for (const p of paths) {
    for (const [vp, size] of Object.entries(viewports)) {
      await page.setViewportSize(size);
      const res = await page.goto(BASE + p, { waitUntil: "load" }).catch((e) => ({ status: () => "ERR " + e.message }));
      await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(300);
      const file = path.join(OUT, `${who}__${vp}__${p.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home"}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`${res?.status?.()} ${who} ${vp} ${p} -> ${page.url().replace(BASE, "")} ${path.basename(file)}`);
    }
  }
  await page.close();
}

const visitor = await browser.newContext();
await capture(visitor, "visitor", PUBLIC);

const roles = [["student", "lehigh.edu", MEMBER, null], ["organizer", "example.com", ORGANIZER, "organizer"], ["kitchen", "example.com", KITCHEN, "kitchen_staff"], ["admin", "example.com", ADMIN, "admin"]];
for (const [who, domain, paths, role] of roles) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const email = `shots-${who}-${Date.now()}@${domain}`;
  await signIn(page, email, `Sample ${who[0].toUpperCase() + who.slice(1)}`);
  if (role) await q(`insert into user_roles(user_id, role) select id, $2 from profiles where email=$1 on conflict do nothing`, [email, role]);
  if (who === "student") {
    // Give the student some state: allergies + an RSVP + a notification.
    const uid = (await q(`select id from profiles where email=$1`, [email]))[0].id;
    await q(`insert into user_allergens(user_id, allergen_code, severity) values ($1,'sesame_seed','severe'),($1,'tree_nuts','allergy') on conflict do nothing`, [uid]);
    await q(`insert into dietary_profiles(user_id, diets) values ($1, '{vegetarian}') on conflict do nothing`, [uid]);
    await q(`insert into rsvps(event_id, user_id, status) values ($1,$2,'going') on conflict do nothing`, [shabbat.id, uid]);
    await q(`insert into notifications(user_id, event_id, kind, title, body, link, is_urgent) values ($1,$2,'menu_urgent','Urgent menu update: [DEMO] Shabbat Dinner','[DEMO] Example urgent notice.', '/events/${shabbat.slug}#menu', true)`, [uid, shabbat.id]);
  }
  await page.close();
  await capture(ctx, who, paths);
  await ctx.close();
}
await browser.close();
