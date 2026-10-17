// Public configuration. These values are safe to expose to the browser.
// Next.js inlines NEXT_PUBLIC_* at build time, so they must be read with
// literal property access (not process.env[name]).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing Supabase settings. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY " +
        "(see .env.example and SETUP.md).",
    );
  }
  return { url: supabaseUrl, key: supabaseKey };
}

/**
 * Public site URL without a trailing slash. Falls back to Vercel's production
 * domain (per-deployment URLs sit behind Vercel's login), then the deployment
 * URL, then localhost. Adds https:// if the scheme was left off.
 */
export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const prod = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const deploy = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  let url = explicit || prod || deploy || "http://localhost:3000";
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  return url.replace(/\/+$/, "");
}

export const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
