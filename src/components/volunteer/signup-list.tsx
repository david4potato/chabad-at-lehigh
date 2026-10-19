"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Copy, Mail } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/cn";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

export type SignupListItem = { user_id: string; name: string; email: string; when: string };

/**
 * Who signed up for a shift (organizers), first to sign up first, with "Email everyone" (BCC)
 * and "Remove" (after a confirm step) for someone who can't come. Stays mounted when the
 * last person is removed, so the result message isn't lost.
 */
export function SignupList({
  shiftId,
  signups,
  onRemove,
  reopensSpot = true,
  emptyText = "Nobody yet.",
}: {
  shiftId: string;
  signups: SignupListItem[];
  onRemove?: (shiftId: string, userId: string) => Promise<ActionResult>;
  /** False once the shift has started, isn't open, or its event isn't published, so nobody else can take the spot. */
  reopensSpot?: boolean;
  emptyText?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [removeResult, setRemoveResult] = useState<ActionResult | null>(null);
  const [removing, startRemove] = useTransition();
  const statusRef = useRef<HTMLDivElement>(null);
  const emails = signups.map((s) => s.email).filter(Boolean);
  // Encode each address but keep the commas: long mailto links get cut off by some mail apps.
  const mailto = `mailto:?bcc=${emails.map(encodeURIComponent).join(",")}`;
  const tooLong = mailto.length > 1900;
  const mailDisabled = emails.length === 0 || tooLong;

  const remove = (userId: string) =>
    startRemove(async () => {
      if (!onRemove) return;
      setRemoveResult(null);
      const res = await onRemove(shiftId, userId);
      // The server's success message says the spot is open again; not true here.
      setRemoveResult(res.ok && !reopensSpot ? { ok: true, message: "Removed. They get a notification." } : res);
      setConfirmId(null);
      // The row goes away after the refresh; keep keyboard focus nearby, on the result.
      statusRef.current?.focus();
    });

  return (
    <div className="space-y-4">
      {signups.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <ol className="divide-y divide-stone-100 rounded-xl border border-stone-200">
          {signups.map((s, i) => {
            const nameId = `signup-${s.user_id}-name`;
            return (
              <li key={s.user_id} className="px-4 py-2">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex min-w-0 gap-2 pt-1">
                    <span className="w-5 shrink-0 text-sm text-muted" aria-hidden="true">
                      {i + 1}.
                    </span>
                    <div className="min-w-0">
                      <p id={nameId} className="font-semibold text-ink">
                        {s.name}
                      </p>
                      {s.email ? (
                        <a href={`mailto:${s.email}`} className="inline-flex min-h-11 items-center break-all text-sm text-brand-700 hover:underline">
                          {s.email}
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-x-3 pl-7 sm:pl-0">
                    <p className="text-xs text-muted">Signed up {s.when}</p>
                    {onRemove && confirmId !== s.user_id ? (
                      <Button
                        variant="ghost"
                        className="text-red-700 hover:bg-red-50"
                        aria-describedby={nameId}
                        onClick={() => {
                          setRemoveResult(null);
                          setConfirmId(s.user_id);
                        }}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
                {onRemove && confirmId === s.user_id ? (
                  <div className="mb-2 mt-1 space-y-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    <p>
                      {reopensSpot
                        ? `Take ${s.name} off this shift? Their spot opens up and they get a notification.`
                        : `Take ${s.name} off this shift? They get a notification.`}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="danger" disabled={removing} onClick={() => remove(s.user_id)}>
                        {removing ? "Removing…" : "Yes, remove"}
                      </Button>
                      <Button variant="secondary" disabled={removing} onClick={() => setConfirmId(null)}>
                        Keep
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      <div ref={statusRef} tabIndex={-1} className={removeResult ? undefined : "sr-only"}>
        <FormMessage state={removeResult} />
      </div>
      {signups.length > 0 ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <a
            href={mailDisabled ? undefined : mailto}
            className={cn(buttonClasses("secondary", "md"), mailDisabled && "pointer-events-none opacity-50")}
            aria-disabled={mailDisabled}
          >
            <Mail className="size-4" aria-hidden="true" /> Email everyone
          </a>
          <Button
            variant="secondary"
            disabled={emails.length === 0}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(emails.join(", "));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "Copied" : "Copy emails"}
          </Button>
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {copied ? "Emails copied." : ""}
      </span>
      {tooLong ? <p className="text-sm text-muted">Too many people for one email link. Use Copy emails and paste them into BCC.</p> : null}
    </div>
  );
}
