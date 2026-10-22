"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Check, Clock, Hourglass, Minus, Plus, UserCheck, X } from "lucide-react";
import { setRsvp } from "@/app/events/actions";
import { initialActionState } from "@/lib/action-result";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Button, buttonClasses } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { FormMessage } from "@/components/ui/form-message";
import { Form } from "@/components/ui/form";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input, Label, Textarea } from "@/components/ui/field";
import type { ApprovalMode, EventCounts, EventStatus, MyRsvp } from "@/lib/data/events";
import {
  CANCEL_AFTER_CLOSE_MESSAGE,
  CLOSED_MESSAGES,
  approvalNote,
  capacityInfo,
  guestApprovalNote,
  guestSummary,
  plural,
  rsvpClosedReason,
} from "./event-utils";

export type RsvpEvent = {
  id: string;
  slug: string;
  status: EventStatus;
  starts_at: string;
  ends_at: string | null;
  rsvp_enabled: boolean;
  rsvp_deadline: string | null;
  capacity: number | null;
  approval_mode: ApprovalMode;
  max_guests_per_rsvp: number;
};

type Props = {
  event: RsvpEvent;
  counts: EventCounts | null;
  rsvp: MyRsvp | null;
  signedIn: boolean;
  /** Students and staff (community guests may need approval). */
  isMember: boolean;
  /** Set when someone returns from sign-in with ?rsvp=going|not_going. */
  intent?: "going" | "not_going" | null;
};

const STATUS_VIEW = {
  going: { Icon: Check, title: "You're going", box: "bg-green-50 border-green-200 text-green-900" },
  waitlist: { Icon: Hourglass, title: "You're on the waitlist", box: "bg-amber-50 border-amber-200 text-amber-950" },
  pending: { Icon: Clock, title: "Waiting for organizer approval", box: "bg-brand-50 border-brand-200 text-brand-900" },
  not_going: { Icon: X, title: "You're not going", box: "bg-stone-50 border-stone-200 text-ink" },
  declined: { Icon: X, title: "Your RSVP wasn't confirmed", box: "bg-red-50 border-red-200 text-red-900" },
} as const;

const STATUS_HINT: Record<keyof typeof STATUS_VIEW, string> = {
  going: "See you there!",
  waitlist: "If a spot opens, we'll confirm you automatically and notify you.",
  pending: "An organizer will confirm your spot. We'll send you a notification.",
  not_going: "Thanks for letting us know. Hope to see you next time.",
  declined: "Questions? Contact the organizer.",
};

const FOCUS_TARGETS = {
  summary: "[data-rsvp-summary]",
  form: "button[name='response']",
  change: "[data-change-rsvp]",
} as const;

function ResponseButton({ value, children, active }: { value: "going" | "not_going"; children: string; active: boolean }) {
  const { pending, data } = useFormStatus();
  const thisPending = pending && data?.get("response") === value;
  return (
    <button
      type="submit"
      name="response"
      value={value}
      aria-disabled={pending || undefined}
      onClick={(e) => {
        if (pending) e.preventDefault();
      }}
      aria-pressed={active}
      className={cn(
        buttonClasses(value === "going" ? "primary" : "secondary", "lg"),
        "w-full",
        active && value === "not_going" && "border-ink",
      )}
    >
      {thisPending ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
      ) : value === "going" ? (
        <UserCheck className="size-5" aria-hidden="true" />
      ) : null}
      {thisPending ? "Saving…" : children}
    </button>
  );
}

export function RsvpPanel({ event, counts, rsvp, signedIn, isMember, intent }: Props) {
  const closed = rsvpClosedReason(event);
  const hasSpot = rsvp?.status === "going" || rsvp?.status === "pending" || rsvp?.status === "waitlist";
  const [editing, setEditing] = useState(!rsvp || rsvp.status === "not_going");
  // Declined guests start at 0 so a note-only edit doesn't ask for them again,
  // and a count above a newly lowered limit is clamped so saving still works.
  const savedGuests =
    hasSpot && rsvp.guest_status !== "declined" ? Math.min(rsvp.guest_count, event.max_guests_per_rsvp) : 0;
  const [guests, setGuests] = useState(savedGuests);
  // An error stays under the form until the person moves on (Change RSVP or Keep my current RSVP).
  const [showMessage, setShowMessage] = useState(true);
  // The form and the status box swap places, so focus moves to whichever one appears next.
  const panelRef = useRef<HTMLDivElement>(null);
  const focusNext = useRef<keyof typeof FOCUS_TARGETS | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    const el = target ? panelRef.current?.querySelector<HTMLElement>(FOCUS_TARGETS[target]) : null;
    if (el) {
      focusNext.current = null;
      el.focus();
    }
  }, [editing, rsvp]);
  const [state, formAction] = useActionState(async (prev: typeof initialActionState, formData: FormData) => {
    const result = await setRsvp(prev, formData);
    setShowMessage(true);
    if (result.ok) {
      focusNext.current = "summary";
      setEditing(false);
      // "Not going" clears guests in the database, so a later "Going" starts from 0 too.
      if (formData.get("response") === "not_going") setGuests(0);
    }
    return result;
  }, initialActionState);

  // Confirmed guests share one approval, so the stepper stops at their number (the guest box explains how to add more).
  const guestsConfirmed = hasSpot && event.approval_mode !== "auto" && rsvp.guest_status === "approved";
  const guestLimit = guestsConfirmed ? Math.min(rsvp.guest_count, event.max_guests_per_rsvp) : event.max_guests_per_rsvp;
  const overGuestLimit = hasSpot && rsvp.guest_count > event.max_guests_per_rsvp;

  const capacity = capacityInfo(event.capacity, counts, !closed);
  const deadline = event.rsvp_deadline ? `RSVP by ${formatDateTime(event.rsvp_deadline)}` : null;
  const note = approvalNote(event.approval_mode, isMember);
  const guestNote = guestApprovalNote(event.approval_mode);
  const returnTo = (response: string) => `/sign-in?next=${encodeURIComponent(`/events/${event.slug}?rsvp=${response}`)}`;

  // One line: "58 spots left · RSVP by Fri, Oct 23, 12:00 PM".
  const infoLine =
    capacity || deadline ? (
      <p className="text-sm text-muted">
        {capacity ? (
          <span
            className={cn(
              "font-semibold",
              capacity.tone === "amber" ? "text-amber-800" : capacity.tone === "gold" ? "text-gold-700" : "text-muted",
            )}
          >
            {capacity.text}
          </span>
        ) : null}
        {capacity && deadline ? " · " : null}
        {deadline}
      </p>
    ) : null;

  // ---- Closed (cancelled / ended / closed / deadline) ----
  if (closed) {
    // New RSVPs are closed, but people can still cancel so their seat can go to someone else.
    const canCancel = hasSpot && (closed === "closed" || closed === "deadline");
    return (
      <div className="space-y-3">
        {rsvp && rsvp.status !== "not_going" ? <StatusSummary rsvp={rsvp} /> : null}
        {canCancel ? (
          <Form action={formAction} state={state} className="space-y-3">
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="slug" value={event.slug} />
            <input type="hidden" name="guest_count" value={0} />
            <Alert tone="info">{CANCEL_AFTER_CLOSE_MESSAGE}</Alert>
            <SubmitButton
              name="response"
              value="not_going"
              variant="secondary"
              className="w-full"
              onClick={(e) => {
                if (!confirm("Cancel your spot? RSVPs are closed, so you can't RSVP again.")) e.preventDefault();
              }}
            >
              I can&apos;t make it
            </SubmitButton>
          </Form>
        ) : (
          <Alert tone={closed === "cancelled" ? "warning" : "info"}>{CLOSED_MESSAGES[closed]}</Alert>
        )}
        <FormMessage state={state} />
      </div>
    );
  }

  // ---- Signed out ----
  if (!signedIn) {
    return (
      <div className="space-y-3">
        {infoLine}
        <div className="grid grid-cols-2 gap-3">
          <Link href={returnTo("going")} className={cn(buttonClasses("primary", "lg"), "w-full")}>
            <UserCheck className="size-5" aria-hidden="true" /> Going
          </Link>
          <Link href={returnTo("not_going")} className={cn(buttonClasses("secondary", "lg"), "w-full")}>
            Not going
          </Link>
        </div>
        <p className="text-sm text-muted">You&apos;ll sign in with your email first — no password needed.</p>
      </div>
    );
  }

  const canChange = rsvp?.status !== "declined";

  return (
    <div ref={panelRef} className="space-y-3">
      {rsvp && !editing ? (
        <>
          <StatusSummary rsvp={rsvp} />
          {canChange ? (
            <Button
              variant="secondary"
              className="w-full"
              data-change-rsvp
              onClick={() => {
                focusNext.current = "form";
                setEditing(true);
                setShowMessage(false);
              }}
            >
              Change RSVP
            </Button>
          ) : null}
        </>
      ) : (
        <Form action={formAction} state={state} className="space-y-4">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="slug" value={event.slug} />
          <input type="hidden" name="guest_count" value={guests} />

          {intent && !rsvp ? (
            <Alert tone="info">
              {intent === "going"
                ? "You're signed in. Tap Going to save your spot."
                : "You're signed in. Tap Not going to let us know."}
            </Alert>
          ) : null}

          {infoLine}

          {/* Optional extras, tucked away so Going / Not going stay the obvious next step. */}
          <div>
            {event.max_guests_per_rsvp > 0 ? (
              // Opens when the saved RSVP has guests. Based on the saved RSVP, not the stepper,
              // so the box doesn't snap shut when someone taps down to 0.
              <details open={hasSpot && rsvp.guest_count > 0} className="text-sm">
                <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold text-brand-700 hover:underline">
                  <span>
                    Bringing guests? (optional)
                    {guests > 0 ? <span className="font-normal text-muted"> · {plural(guests, "guest")}</span> : null}
                  </span>
                </summary>
                <div className="mt-1 space-y-3 rounded-2xl border border-stone-200 bg-stone-50/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink" id={`guests-label-${event.id}`}>
                        How many guests?
                      </p>
                      <p className="text-sm text-muted">Up to {plural(event.max_guests_per_rsvp, "guest")}</p>
                    </div>
                    <div className="flex items-center gap-2" role="group" aria-labelledby={`guests-label-${event.id}`}>
                      <button
                        type="button"
                        onClick={() => setGuests((g) => Math.max(0, g - 1))}
                        disabled={guests === 0}
                        className="flex size-11 items-center justify-center rounded-full border border-stone-300 bg-white text-ink disabled:opacity-40"
                        aria-label="One fewer guest"
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </button>
                      <output className="w-6 text-center text-lg font-bold" aria-live="polite">
                        {guests}
                      </output>
                      <button
                        type="button"
                        onClick={() => setGuests((g) => Math.min(guestLimit, g + 1))}
                        disabled={guests >= guestLimit}
                        className="flex size-11 items-center justify-center rounded-full border border-stone-300 bg-white text-ink disabled:opacity-40"
                        aria-label="One more guest"
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  {rsvp?.guest_status === "declined" && rsvp.guest_count > 0 ? (
                    <p className="text-sm text-muted">Your guests weren&apos;t confirmed by the organizer.</p>
                  ) : null}
                  {guestsConfirmed && guestLimit < event.max_guests_per_rsvp ? (
                    <p className="text-sm text-muted">
                      Your guests are already confirmed. To bring more, set guests to 0 and tap Going, then add them
                      all again. They&apos;ll need approval again, and their seats aren&apos;t held until then.
                    </p>
                  ) : null}
                  {guests > 0 && guestNote && !guestsConfirmed ? <p className="text-sm text-muted">{guestNote}</p> : null}
                  {guests > 0 ? (
                    <div className="space-y-2">
                      <Label htmlFor={`guest-names-${event.id}`}>Guest names (optional)</Label>
                      <Input
                        id={`guest-names-${event.id}`}
                        name="guest_names"
                        maxLength={300}
                        defaultValue={rsvp?.guest_names ?? ""}
                        placeholder="e.g. Sarah, Josh"
                      />
                    </div>
                  ) : null}
                </div>
              </details>
            ) : null}

            <details className="text-sm">
              <summary className="flex min-h-11 cursor-pointer list-none items-center font-semibold text-brand-700 hover:underline">
                Add a note for the organizer (optional)
              </summary>
              <div className="mt-1 space-y-2">
                <Label htmlFor={`note-${event.id}`} className="sr-only">
                  Note for the organizer
                </Label>
                <Textarea
                  id={`note-${event.id}`}
                  name="note"
                  rows={2}
                  maxLength={500}
                  defaultValue={rsvp?.note ?? ""}
                  placeholder="Arriving late, first time coming…"
                />
                <p className="text-sm text-muted">For allergies, use your dietary profile instead — it&apos;s private.</p>
              </div>
            </details>
          </div>

          {overGuestLimit ? (
            <p className="text-sm text-muted">
              {event.max_guests_per_rsvp === 0
                ? "This event no longer allows guests."
                : `This event now allows up to ${plural(event.max_guests_per_rsvp, "guest")}.`}
            </p>
          ) : null}
          {note ? <p className="text-sm text-muted">{note}</p> : null}

          <div className="grid grid-cols-2 gap-3">
            <ResponseButton value="going" active={rsvp?.status === "going"}>
              Going
            </ResponseButton>
            <ResponseButton value="not_going" active={rsvp?.status === "not_going"}>
              Not going
            </ResponseButton>
          </div>
          {rsvp && rsvp.status !== "not_going" ? (
            <button
              type="button"
              onClick={() => {
                focusNext.current = "change";
                setEditing(false);
                setShowMessage(false);
                setGuests(savedGuests);
              }}
              className="min-h-11 w-full text-sm font-semibold text-muted hover:text-ink"
            >
              Keep my current RSVP
            </button>
          ) : null}
        </Form>
      )}
      {/* Success shows in the status box above (role="status"), so only errors appear here. */}
      <FormMessage state={showMessage && !state.ok ? state : null} />
    </div>
  );
}

function StatusSummary({ rsvp }: { rsvp: MyRsvp }) {
  const view = STATUS_VIEW[rsvp.status];
  const guests = guestSummary(rsvp.guest_count, rsvp.guest_status);
  return (
    <div className={cn("flex gap-3 rounded-2xl border p-4", view.box)} role="status" tabIndex={-1} data-rsvp-summary>
      <view.Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-bold">
          {view.title}
          {guests && rsvp.status !== "not_going" ? <span className="font-semibold"> · {guests}</span> : null}
        </p>
        <p className="text-sm opacity-90">{STATUS_HINT[rsvp.status]}</p>
      </div>
    </div>
  );
}
