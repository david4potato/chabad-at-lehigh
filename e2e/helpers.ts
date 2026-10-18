import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

// Local-only test helpers. They talk to the LOCAL Supabase stack started with
// `npx supabase start` — never to a hosted project.
const MAILPIT = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";
const DB_URL = process.env.E2E_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export type TestRole = "student" | "community_guest" | "organizer" | "kitchen_staff" | "admin";

export function uniqueEmail(prefix: string, domain = "example.com") {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@${domain}`;
}

/** Wait for the newest sign-in email to `email` in Mailpit and return the code. */
export async function getSignInCode(email: string, after: number): Promise<string> {
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const data = (await res.json()) as { messages?: { ID: string; Created: string }[] };
    const latest = (data.messages ?? []).find((m) => new Date(m.Created).getTime() >= after - 2000);
    if (latest) {
      const msg = (await (await fetch(`${MAILPIT}/api/v1/message/${latest.ID}`)).json()) as { Text: string };
      const match = /code in the app:\W*(\d{6,10})/i.exec(msg.Text);
      if (match) return match[1];
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email for ${email}`);
}

export async function db<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    const result = await client.query(sql, params);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

export async function grantRole(email: string, role: TestRole) {
  await db(
    `insert into public.user_roles (user_id, role)
     select id, $2::public.app_role from public.profiles where email = lower($1)
     on conflict do nothing`,
    [email, role],
  );
}

/**
 * Sign in through the real UI (email → code from Mailpit), completing the
 * welcome form for new accounts. Returns once the destination page loads.
 */
export async function signIn(page: Page, email: string, opts: { next?: string; name?: string; newAccount?: boolean } = {}) {
  const started = Date.now();
  await page.goto(`/sign-in${opts.next ? `?next=${encodeURIComponent(opts.next)}` : ""}`);
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: /email me a sign-in link/i }).click();
  const code = await getSignInCode(email, started);
  await page.getByLabel("Sign-in code").fill(code);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  // New accounts always go to /welcome first; existing ones go straight to `next`.
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"), { timeout: 20_000 });
  await page.waitForLoadState("domcontentloaded");

  if (opts.newAccount || new URL(page.url()).pathname === "/welcome") {
    await page.waitForURL((url) => url.pathname === "/welcome", { timeout: 20_000 });
    await page.getByLabel(/full name/i).fill(opts.name ?? "Test Person");
    await page.getByRole("button", { name: /continue|save/i }).first().click();
    await page.waitForURL((url) => url.pathname !== "/welcome", { timeout: 20_000 });
    // The dietary step offers "Skip for now" (at the top and the bottom).
    const skip = page.getByRole("link", { name: /skip for now/i }).first();
    if (await skip.isVisible().catch(() => false)) {
      await skip.click();
      await page.waitForLoadState("networkidle");
    }
  }
}

/** Create (via sign-in) a user with an extra role and leave the page signed in. */
export async function signInAs(page: Page, role: TestRole, opts: { next?: string } = {}) {
  const domain = role === "student" ? "lehigh.edu" : "example.com";
  const email = uniqueEmail(role.replace("_", ""), domain);
  await signIn(page, email, { name: `Test ${role}`, newAccount: true });
  if (role !== "student" && role !== "community_guest") await grantRole(email, role);
  if (opts.next) await page.goto(opts.next);
  return email;
}

export async function signOut(page: Page) {
  await page.context().clearCookies();
}

export async function firstShabbatSlug(): Promise<string> {
  const rows = await db<{ slug: string }>(
    `select slug from public.events
     where category = 'shabbat_dinner' and status = 'published' and starts_at > now()
     order by starts_at limit 1`,
  );
  expect(rows.length).toBeGreaterThan(0);
  return rows[0].slug;
}
