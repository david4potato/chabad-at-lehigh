"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/client";
import { NEXT_COOKIE } from "@/lib/safe-redirect";
import { turnstileSiteKey } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { postSignInDestination } from "./actions";

declare global {
  interface Window {
    turnstile?: {
      render: (
        el: HTMLElement,
        opts: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          appearance?: "always" | "execute" | "interaction-only";
        },
      ) => string;
      reset: (id?: string) => void;
    };
  }
}

const RESEND_SECONDS = 60;
const STUDENT_DOMAIN = SITE.campus.studentEmailDomains[0];

function authErrorMessage(
  err: { message?: string; status?: number; code?: string } | null,
  step: "send" | "verify",
): string {
  if (!err) return "Something went wrong. Please try again.";
  if (err.status === 429 || err.code === "over_email_send_rate_limit" || err.code === "over_request_rate_limit") {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (err.code === "captcha_failed") return "The bot check failed. Please try again.";
  if (step === "send") {
    if (err.code === "validation_failed" || err.code === "email_address_invalid") {
      return "That email address doesn't look right. Check it for typos and try again.";
    }
    return "We couldn't send the sign-in email. Please try again.";
  }
  if (err.code === "otp_expired" || /expired|invalid/i.test(err.message ?? "")) {
    return "That code is incorrect or has expired. Check the latest email, or send a new code.";
  }
  return "We couldn't sign you in. Please try again.";
}

export function SignInForm({ next }: { next: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  // One widget, drawn once into a container that stays mounted on both steps,
  // so "Resend code" and "Use a different email" get a fresh token after reset.
  function renderCaptcha() {
    if (!turnstileSiteKey || !captchaRef.current || !window.turnstile) return;
    captchaRef.current.innerHTML = "";
    widgetId.current = window.turnstile.render(captchaRef.current, {
      sitekey: turnstileSiteKey,
      callback: setCaptchaToken,
      "expired-callback": () => setCaptchaToken(null),
      // Only takes up space when Cloudflare actually needs the person to click.
      appearance: "interaction-only",
    });
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    // Drop trailing punctuation picked up when copying an address.
    const address = email
      .trim()
      .toLowerCase()
      .replace(/[.,;]+$/, "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (turnstileSiteKey && !captchaToken) {
      setError("Please complete the bot check first.");
      return;
    }
    setBusy(true);
    // Remember where to go after the magic link is opened (same browser).
    document.cookie = `${NEXT_COOKIE}=${encodeURIComponent(next)}; Path=/; Max-Age=3600; SameSite=Lax`;
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        shouldCreateUser: true,
        captchaToken: captchaToken ?? undefined,
      },
    });
    setBusy(false);
    if (turnstileSiteKey) {
      setCaptchaToken(null);
      window.turnstile?.reset(widgetId.current ?? undefined);
    }
    if (err) {
      setError(authErrorMessage(err, "send"));
      return;
    }
    setEmail(address);
    setStep("code");
    setCooldown(RESEND_SECONDS);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      setError("Enter the code from your email.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (err) {
      setBusy(false);
      setError(authErrorMessage(err, "verify"));
      return;
    }
    const destination = await postSignInDestination(next);
    // Full navigation so every part of the page picks up the new session.
    window.location.assign(destination);
  }

  return (
    <div className="space-y-4">
      {turnstileSiteKey ? (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={renderCaptcha}
        />
      ) : null}

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-4" noValidate>
          <Field label="Email address" htmlFor="email" hint={`${SITE.campus.name} students: use your @${STUDENT_DOMAIN} address.`}>
            <Input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={`you@${STUDENT_DOMAIN}`}
              aria-describedby="email-hint"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            <Mail className="size-5" aria-hidden="true" />
            {busy ? "Sending…" : "Email me a sign-in link"}
          </Button>
          <p className="text-center text-sm text-muted">No password needed. New here? This creates your account.</p>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4" noValidate>
          <Alert tone="success" title="Check your email">
            We sent a sign-in link and a code to <strong className="break-all">{email}</strong>. Tap the link on this
            device, or type the code here.
          </Alert>
          <Field label="Sign-in code" htmlFor="code">
            <Input
              ref={codeRef}
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={10}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl font-bold tracking-[0.4em]"
              placeholder="••••••"
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline disabled:text-muted disabled:no-underline"
              onClick={() => sendCode()}
              disabled={busy || cooldown > 0}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-semibold text-muted hover:text-ink hover:underline"
              onClick={() => {
                setStep("email");
                setCode("");
                setError(null);
              }}
            >
              Use a different email
            </button>
          </div>
          <p className="text-sm text-muted">Can&apos;t find it? Check your spam or promotions folder.</p>
        </form>
      )}

      {/* One bot-check widget for both steps, so Resend and a different email get fresh tokens. */}
      {turnstileSiteKey ? <div ref={captchaRef} /> : null}
    </div>
  );
}
