import { createClient } from "@/lib/supabase/server";

// Vercel Cron calls this once a day (vercel.json). Free Supabase projects pause
// after a week without activity, which would take the site down over breaks.
// Harmless on Pro (which never pauses); kept in case the project moves to Free.
export async function GET() {
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").select("key").limit(1);
  return Response.json({ ok: !error }, { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } });
}
