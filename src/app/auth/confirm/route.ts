import type { EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { NEXT_COOKIE, safeNextPath } from "@/lib/safe-redirect";

const OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup", "invite", "recovery", "email_change"];

/**
 * Magic-link landing page. Supports both:
 *  - ?token_hash=...&type=email  (recommended email template; works on any device)
 *  - ?code=...                   (default PKCE link; only works in the same browser)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next") ?? request.cookies.get(NEXT_COOKIE)?.value ?? null, "/");

  const supabase = await createClient();
  let ok = false;
  let errorKind = "link";

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
    if (error && /code verifier|code_verifier/i.test(error.message)) errorKind = "device";
  }

  const destination = new URL(request.url);
  destination.search = "";

  if (!ok) {
    destination.pathname = "/sign-in";
    destination.searchParams.set("error", errorKind);
    if (next !== "/") destination.searchParams.set("next", next);
    return NextResponse.redirect(destination);
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  const { data: profile } = userId
    ? await supabase.from("profiles").select("onboarded_at").eq("id", userId).maybeSingle()
    : { data: null };
  if (profile && !profile.onboarded_at) {
    destination.pathname = "/welcome";
    destination.searchParams.set("next", next);
  } else {
    const target = new URL(next, request.url);
    destination.pathname = target.pathname;
    destination.search = target.search;
  }

  const response = NextResponse.redirect(destination);
  response.cookies.delete(NEXT_COOKIE);
  return response;
}
