// Dev tool: follow every internal link as a visitor and as an admin, and
// report any page that doesn't return 200/redirect or that logs browser errors.
// Usage: node e2e/crawl.mjs [baseUrl]
import { chromium } from "playwright-core";
import pg from "pg";

const BASE = process.argv[2] ?? "http://localhost:3100";
const MAIL = "http://127.0.0.1:54324";
const DB = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const SKIP = [/^\/auth\//, /\/attendees\/export$/, /\.ics$/];

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
      const r = /code in the app:\W*(\d{6,10})/i.exec((await (await fetch(`${MAIL}/api/v1/message/${m.ID}`)).json()).Text);
      if (r) return r[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("no code");
}

async function crawl(context, label) {
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${page.url()} :: ${m.text().slice(0, 160)}`); });
  page.on("pageerror", (e) => errors.push(`${page.url()} :: ${e.message.slice(0, 160)}`));
  const seen = new Set(), queue = ["/"], bad = [];
  while (queue.length && seen.size < 200) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    const res = await page.goto(BASE + path, { waitUntil: "load" }).catch((e) => ({ status: () => "ERR " + e.message.slice(0, 80) }));
    const status = res?.status?.();
    if (status !== 200) bad.push(`${status} ${path}`);
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")));
    for (const h of hrefs) {
      if (!h || !h.startsWith("/") || h.startsWith("//")) continue;
      const clean = h.split("#")[0];
      if (!clean || SKIP.some((r) => r.test(clean)) || seen.has(clean)) continue;
      queue.push(clean);
    }
  }
  console.log(`[${label}] visited ${seen.size} pages; problems: ${bad.length ? bad.join(", ") : "none"}`);
  console.log(`[${label}] browser errors: ${errors.length ? "\n  " + [...new Set(errors)].join("\n  ") : "none"}`);
  await page.close();
}

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, headless: true });
await crawl(await browser.newContext(), "visitor");

const ctx = await browser.newContext();
const p = await ctx.newPage();
const email = `crawl-admin-${Date.now()}@example.com`;
const t = Date.now();
await p.goto(`${BASE}/sign-in`);
await p.fill("#email", email);
await p.click("button[type=submit]");
await p.waitForSelector("#code");
await p.fill("#code", await code(email, t));
await p.click("button[type=submit]");
await p.waitForURL((u) => !u.pathname.startsWith("/sign-in"));
await q(`update profiles set full_name='Crawl Admin', onboarded_at=now() where email=$1`, [email]);
await q(`insert into user_roles(user_id, role) select id, r::app_role from profiles, unnest(array['organizer','kitchen_staff','admin']) r where email=$1 on conflict do nothing`, [email]);
await p.close();
await crawl(ctx, "admin");
await browser.close();
