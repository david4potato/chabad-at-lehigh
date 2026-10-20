"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Mail, Search } from "lucide-react";
import { cancelRsvp, decideGuests, decideRsvp, setCheckIn } from "@/app/admin/events/[id]/attendees/actions";
import type { ActionResult } from "@/lib/action-result";
import type { Attendee } from "@/lib/data/attendees";
import { GUEST_STATUS_LABEL, MEMBER_LABEL, RSVP_STATUS_LABEL } from "@/lib/rsvp-labels";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

const FILTERS = [
  { key: "going", label: "Going" },
  { key: "approval", label: "Needs approval" },
  { key: "waitlist", label: "Waitlist" },
  { key: "not_going", label: RSVP_STATUS_LABEL.not_going },
  { key: "declined", label: RSVP_STATUS_LABEL.declined },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const matches = (a: Attendee, f: FilterKey) =>
  f === "approval" ? a.status === "pending" || (a.guest_status === "pending" && a.guest_count > 0 && a.status !== "not_going") : a.status === f;

const STATUS_TONE = { going: "green", waitlist: "amber", pending: "brand", not_going: "neutral", declined: "red" } as const;

export function AttendeeList({
  eventId,
  attendees,
  capacity,
  seatsTaken,
  ended,
  status,
}: {
  eventId: string;
  attendees: Attendee[];
  capacity: number | null;
  seatsTaken: number;
  /** The event is over: the database refuses to cancel RSVPs from then on. */
  ended: boolean;
  status: "draft" | "published" | "cancelled";
}) {
  const approvals = attendees.filter((a) => matches(a, "approval")).length;
  const [filter, setFilter] = useState<FilterKey>(approvals > 0 ? "approval" : "going");
  const [query, setQuery] = useState("");
  // Each row shows its own result, so it's next to the buttons on a phone.
  const [results, setResults] = useState<Record<string, ActionResult>>({});
  const [announcement, setAnnouncement] = useState("");
  const [copied, setCopied] = useState(false);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [, start] = useTransition();

  const goingEmails = attendees.filter((a) => a.status === "going" && a.email).map((a) => a.email);
  // Encode each address but keep the commas: long mailto links get cut off by some mail apps.
  const mailto = `mailto:?bcc=${goingEmails.map(encodeURIComponent).join(",")}`;
  const tooManyForMailto = mailto.length > 1900;
  const mailDisabled = goingEmails.length === 0 || tooManyForMailto;
  const fits = (seats: number) => capacity === null || seatsTaken + seats <= capacity;
  const q = query.trim().toLowerCase();
  // A row you acted on stays (with its result) until you change the filter, so an approved
  // person doesn't vanish from Needs approval before you see what happened.
  const visible = attendees.filter(
    (a) => (matches(a, filter) || a.id in results) && (!q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)),
  );

  const run = (a: Attendee, fn: () => Promise<ActionResult>) => {
    // Set outside the transition: state set inside an async transition only shows once it ends.
    setPendingIds((s) => new Set(s).add(a.id));
    start(async () => {
      const r = await fn();
      // Updates after an await need their own transition to land together with the refreshed list.
      start(() => {
        setPendingIds((s) => new Set([...s].filter((id) => id !== a.id)));
        setResults((m) => ({ ...m, [a.id]: r }));
        const text = r.ok ? r.message : r.error;
        // A no-break space makes a repeat of the same message still count as new text.
        if (text) setAnnouncement((prev) => (prev === `${a.name}: ${text}` ? `${prev}\u00a0` : `${a.name}: ${text}`));
      });
    });
  };

  return (
    <div className="space-y-4">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2" role="tablist" aria-label="Filter attendees">
          {FILTERS.map((f) => {
            const n = attendees.filter((a) => matches(a, f.key)).length;
            return (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={filter === f.key}
                onClick={() => {
                  setFilter(f.key);
                  setResults({});
                }}
                className={cn(
                  "focus-inset inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold",
                  filter === f.key ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-ink",
                )}
              >
                {f.label}
                <span className={cn("rounded-full px-2 text-sm", filter === f.key ? "bg-white/20" : "bg-stone-100")}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search attendees"
          className="pl-8"
        />
      </div>

      {/* Always in the page so screen readers hear each row's result. */}
      <p className="sr-only" role="status">
        {announcement}
      </p>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-muted">
          {attendees.length > 0
            ? "No one here."
            : ended || status === "cancelled"
              ? "No one RSVP'd to this event."
              : status === "draft"
                ? "No RSVPs yet. Publish the event so people can RSVP."
                : "No RSVPs yet. Share the event link or invite people below."}
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => {
            const busy = pendingIds.has(a.id);
            const r: ActionResult | undefined = results[a.id];
            const rowMessage = r ? (r.ok ? r.message : r.error) : undefined;
            const guestsPending = a.guest_count > 0 && a.guest_status === "pending";
            // Seats this person needs if confirmed now (approved guests count too).
            const needed = 1 + (a.guest_status === "approved" ? a.guest_count : 0);
            // Their own seat is already counted when they're going.
            const guestsFit = a.status !== "going" || fits(a.guest_count);
            return (
              <li key={a.id} className={cn("rounded-2xl border bg-white p-4 shadow-sm", a.checked_in_at ? "border-green-300" : "border-stone-200")}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink">{a.name}</p>
                      <Badge tone={STATUS_TONE[a.status]}>{RSVP_STATUS_LABEL[a.status]}</Badge>
                      <Badge>{MEMBER_LABEL[a.member]}</Badge>
                    </div>
                    <p className="text-sm break-all text-muted">{a.email}</p>
                    {a.guest_count > 0 ? (
                      <p className="mt-1 text-sm text-ink">
                        +{a.guest_count} guest{a.guest_count === 1 ? "" : "s"}
                        {a.guest_names ? ` (${a.guest_names})` : ""} ·{" "}
                        <span className={cn("font-semibold", guestsPending ? "text-brand-800" : a.guest_status === "declined" ? "text-red-700" : "text-green-800")}>
                          {GUEST_STATUS_LABEL[a.guest_status].toLowerCase()}
                        </span>
                      </p>
                    ) : null}
                    {a.note ? <p className="mt-1 text-sm text-ink">&ldquo;{a.note}&rdquo;</p> : null}
                    <p className="mt-1 text-sm text-muted">RSVP&apos;d {formatDateTime(a.created_at)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {a.status === "pending" ? (
                      <>
                        <Button disabled={busy} onClick={() => run(a, () => decideRsvp(eventId, a.id, "approve"))}>
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={busy}
                          onClick={() => {
                            if (confirm(`Decline ${a.name}'s RSVP? They'll be notified.`)) run(a, () => decideRsvp(eventId, a.id, "decline"));
                          }}
                        >
                          Decline
                        </Button>
                      </>
                    ) : null}
                    {a.status === "waitlist" && fits(needed) ? (
                      <Button variant="secondary" disabled={busy} onClick={() => run(a, () => decideRsvp(eventId, a.id, "approve"))}>
                        Confirm
                      </Button>
                    ) : null}
                    {a.status === "waitlist" && !fits(needed) ? (
                      <Button
                        variant="secondary"
                        className="h-auto! min-h-11 whitespace-normal! py-2 text-left"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Confirm ${a.name} even though the event is full?`)) run(a, () => decideRsvp(eventId, a.id, "approve", true));
                        }}
                      >
                        Confirm anyway (over capacity)
                      </Button>
                    ) : null}
                    {guestsPending && a.status !== "pending" && a.status !== "not_going" && a.status !== "declined" ? (
                      <>
                        {guestsFit ? (
                          <Button variant="secondary" disabled={busy} onClick={() => run(a, () => decideGuests(eventId, a.id, "approve"))}>
                            Approve guests
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            className="h-auto! min-h-11 whitespace-normal! py-2 text-left"
                            disabled={busy}
                            onClick={() => {
                              if (confirm(`Approve ${a.name}'s guests even though there aren't enough seats?`))
                                run(a, () => decideGuests(eventId, a.id, "approve", true));
                            }}
                          >
                            Approve guests anyway (over capacity)
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onClick={() => {
                            if (confirm(`Decline ${a.name}'s guests? They'll be notified.`)) run(a, () => decideGuests(eventId, a.id, "decline"));
                          }}
                        >
                          Decline guests
                        </Button>
                      </>
                    ) : null}
                    {a.status === "declined" ? (
                      <Button
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Undo the decline for ${a.name}? They'll be notified.`)) run(a, () => decideRsvp(eventId, a.id, "approve"));
                        }}
                      >
                        Undo decline
                      </Button>
                    ) : null}
                    {!ended && (a.status === "going" || a.status === "waitlist" || a.status === "pending") && !a.checked_in_at ? (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Cancel ${a.name}'s RSVP? They'll be marked as not going and notified.`)) run(a, () => cancelRsvp(eventId, a.id));
                        }}
                      >
                        Cancel RSVP
                      </Button>
                    ) : null}
                    {a.status === "going" ? (
                      <Button
                        size="md"
                        variant={a.checked_in_at ? "secondary" : "primary"}
                        disabled={busy}
                        aria-pressed={Boolean(a.checked_in_at)}
                        onClick={() => run(a, () => setCheckIn(eventId, a.id, !a.checked_in_at))}
                        className="w-full min-w-36 md:w-auto"
                      >
                        {busy ? (
                          "Saving…"
                        ) : a.checked_in_at ? (
                          <>
                            <Check className="size-4" aria-hidden="true" /> Checked in
                          </>
                        ) : (
                          "Check in"
                        )}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {rowMessage ? (
                  // Not a live region itself: the status line above the list announces it once.
                  <Alert tone={r?.ok ? "success" : "danger"} role="none" className="mt-3">
                    {rowMessage}
                  </Alert>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <section aria-labelledby="attendees-export" className="border-t border-stone-200 pt-4">
        <h2 id="attendees-export" className="text-sm font-semibold text-muted">
          Message or export
        </h2>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <a
            href={mailDisabled ? undefined : mailto}
            className={cn(buttonClasses("secondary", "md"), mailDisabled && "pointer-events-none opacity-50")}
            aria-disabled={mailDisabled}
          >
            <Mail className="size-4" aria-hidden="true" /> Email everyone going
          </a>
          <Button
            variant="secondary"
            disabled={goingEmails.length === 0}
            onClick={async () => {
              await navigator.clipboard.writeText(goingEmails.join(", "));
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            {copied ? "Copied!" : "Copy emails"}
          </Button>
          <a href={`/admin/events/${eventId}/attendees/export`} className={buttonClasses("ghost", "md")}>
            Download spreadsheet (CSV)
          </a>
        </div>
        {tooManyForMailto ? (
          <p className="mt-2 text-sm text-muted">Too many people for one email link. Use Copy emails and paste them into BCC.</p>
        ) : null}
      </section>
    </div>
  );
}
