"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Mail } from "lucide-react";
import { SITE } from "@/config/site";
import { createClient } from "@/lib/supabase/client";
import { NEXT_COOKIE } from "@/lib/safe-redirect";
import { turnstileSiteKey } from "@/lib/env";
import { Button } from "@/components/ui/button";
import { Field, FieldError, Input } from "@/components/ui/field";
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

type AuthErr = { message?: string; status?: number; code?: string };

function isRateLimited(err: AuthErr) {
  return err.status === 429 || err.code === "over_email_send_rate_limit" || err.code === "over_request_rate_limit";
}

const WRONG_CODE = "That code is wrong or expired. Check the latest email, or send a new code.";

function authErrorMessage(err: AuthErr | null, step: "send" | "verify"): string {
  if (!err) return "Something went wrong. Please try again.";
  if (isRateLimited(err)) return "Too many attempts. Please wait a minute and try again.";
  if (err.code === "captcha_failed") return "The bot check failed. Please try again.";
  if (step === "send") {
    if (err.code === "validation_failed" || err.code === "email_address_invalid") {
      return "That email address doesn't look right. Check it for typos.";
    }
    return "We couldn't send the sign-in email. Please try again.";
  }
  if (err.code === "otp_expired" || /expired|invalid/i.test(err.message ?? "")) {
    return WRONG_CODE;
  }
  return "We couldn't sign you in. Please try again.";
}

/** An error under a field. `live` means focus was already in the field when it appeared. */
type FieldMessage = { text: string; live: boolean };

/**
 * Shows an error under a field so a screen reader reads it once: focus moves to the field, which reads its
 * label, "invalid" and the linked error. If focus is already there, moving it says nothing, so the error
 * becomes an alert instead (see InlineFieldError).
 */
function showFieldError(input: HTMLInputElement | null, set: (m: FieldMessage) => void, text: string) {
  const live = !!input && document.activeElement === input;
  // Render the error first, so the field already describes it when it takes focus.
  flushSync(() => set({ text, live }));
  if (!live) input?.focus();
}

function InlineFieldError({ id, message }: { id: string; message: FieldMessage | null }) {
  if (!message) return null;
  const text = <FieldError id={id} errors={[message.text]} />;
  return message.live ? <div role="alert">{text}</div> : text;
}

export function SignInForm({ next }: { next: string }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  // Sending problems, rate limits and the bot check show in the alert at the top.
  const [error, setError] = useState<string | null>(null);
  // A bad address or a wrong code shows under its field, linked to it for screen readers.
  const [emailError, setEmailError] = useState<FieldMessage | null>(null);
  const [codeError, setCodeError] = useState<FieldMessage | null>(null);
  const [resends, setResends] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const prevStep = useRef(step);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // The button that changed the step unmounts with its form, so focus goes to the new step's field.
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
    else if (prevStep.current === "code") emailRef.current?.focus();
    prevStep.current = step;
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
    // The buttons use aria-disabled (so they keep focus), so Enter or a click can still land here while busy.
    if (busy) return;
    setError(null);
    setEmailError(null);
    setCodeError(null);
    // Drop trailing punctuation picked up when copying an address.
    const address = email
      .trim()
      .toLowerCase()
      .replace(/[.,;]+$/, "");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(address)) {
      showFieldError(emailRef.current, setEmailError, "Please enter a valid email address.");
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
    if (step === "code") {
      // A resend: move focus off "Resend code" before the cooldown disables it, and say so in "Check your email".
      codeRef.current?.focus();
      setResends((n) => n + 1);
    } else {
      setResends(0);
      setStep("code");
    }
    setCooldown(RESEND_SECONDS);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setCodeError(null);
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      showFieldError(codeRef.current, setCodeError, "Enter the code from your email.");
      return;
    }
    setBusy(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (err) {
      setBusy(false);
      const message = authErrorMessage(err, "verify");
      // Only a wrong or expired code marks the field invalid; network and other errors go in the top alert.
      if (message === WRONG_CODE) showFieldError(codeRef.current, setCodeError, message);
      else setError(message);
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
          <div className="space-y-2">
            <Field
              label="Email address"
              htmlFor="email"
              hint={`${SITE.campus.name} students: use your @${STUDENT_DOMAIN} address.`}
            >
              <Input
                ref={emailRef}
                id="email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? "email-error" : undefined}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                }}
                placeholder={`you@${STUDENT_DOMAIN}`}
              />
            </Field>
            <InlineFieldError id="email-error" message={emailError} />
          </div>
          <Button type="submit" size="lg" className="w-full" aria-disabled={busy || undefined}>
            <Mail className="size-5" aria-hidden="true" />
            {busy ? "Sending…" : "Email me a sign-in link"}
          </Button>
          <p className="text-center text-sm text-muted">No password needed. New here? This creates your account.</p>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4" noValidate>
          <Alert tone="success" title="Check your email">
            {resends > 0 ? (
              // Keyed by the count, so a second resend still changes this live region and is read out.
              <span key={resends}>
                We sent a new code to <strong className="break-all">{email}</strong>. Use the newest one.
              </span>
            ) : (
              <>
                We sent a link and a code to <strong className="break-all">{email}</strong>. Tap the link on this
                device, or enter the code here.
              </>
            )}
          </Alert>
          <div className="space-y-2">
            <Field label="Sign-in code" htmlFor="code">
              <Input
                ref={codeRef}
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={10}
                aria-invalid={codeError ? true : undefined}
                aria-describedby={codeError ? "code-error" : undefined}
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.replace(/\D/g, ""));
                  setCodeError(null);
                }}
                className="text-center text-2xl font-bold tracking-[0.4em]"
                placeholder="••••••"
              />
            </Field>
            <InlineFieldError id="code-error" message={codeError} />
          </div>
          <Button type="submit" size="lg" className="w-full" aria-disabled={busy || undefined}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {/* Keeps focus while sending (aria-disabled); the 60-second countdown is truly disabled, so a
                screen reader isn't read a new name every second. */}
            <button
              type="button"
              className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline disabled:text-muted disabled:no-underline aria-disabled:cursor-not-allowed aria-disabled:text-muted aria-disabled:no-underline"
              onClick={() => sendCode()}
              aria-disabled={busy || undefined}
              disabled={cooldown > 0}
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
