"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Mail, Search } from "lucide-react";
import { decideGuests, decideRsvp, setCheckIn } from "@/app/admin/events/[id]/attendees/actions";
import type { ActionResult } from "@/lib/action-result";
import type { Attendee } from "@/lib/data/attendees";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Button, buttonClasses } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { FormMessage } from "@/components/ui/form-message";

const FILTERS = [
  { key: "going", label: "Going" },
  { key: "approval", label: "Needs approval" },
  { key: "waitlist", label: "Waitlist" },
  { key: "not_going", label: "Not going" },
  { key: "declined", label: "Declined" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const matches = (a: Attendee, f: FilterKey) =>
  f === "approval" ? a.status === "pending" || (a.guest_status === "pending" && a.guest_count > 0 && a.status !== "not_going") : a.status === f;

const STATUS_LABEL = { going: "Going", waitlist: "Waitlist", pending: "Needs approval", not_going: "Not going", declined: "Declined" } as const;
const STATUS_TONE = { going: "green", waitlist: "amber", pending: "brand", not_going: "neutral", declined: "red" } as const;

export function AttendeeList({ eventId, attendees }: { eventId: string; attendees: Attendee[] }) {
  const approvals = attendees.filter((a) => matches(a, "approval")).length;
  const [filter, setFilter] = useState<FilterKey>(approvals > 0 ? "approval" : "going");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();

  const goingEmails = attendees.filter((a) => a.status === "going" && a.email).map((a) => a.email);
  const q = query.trim().toLowerCase();
  const visible = attendees.filter(
    (a) => matches(a, filter) && (!q || a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q)),
  );

  const run = (id: string, fn: () => Promise<ActionResult>) =>
    start(async () => {
      setPendingId(id);
      setResult(await fn());
      setPendingId(null);
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          href={`mailto:?bcc=${encodeURIComponent(goingEmails.join(","))}`}
          className={cn(buttonClasses("secondary", "md"), goingEmails.length === 0 && "pointer-events-none opacity-50")}
          aria-disabled={goingEmails.length === 0}
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
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold",
                  filter === f.key ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-ink",
                )}
              >
                {f.label}
                <span className={cn("rounded-full px-1.5 text-xs", filter === f.key ? "bg-white/20" : "bg-stone-100")}>{n}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or email"
          aria-label="Search attendees"
          className="pl-9"
        />
      </div>

      <FormMessage state={result} />

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-muted">No one here.</p>
      ) : (
        <ul className="space-y-2">
          {visible.map((a) => {
            const busy = pendingId === a.id;
            const guestsPending = a.guest_count > 0 && a.guest_status === "pending";
            return (
              <li key={a.id} className={cn("rounded-2xl border bg-white p-4 shadow-sm", a.checked_in_at ? "border-green-300" : "border-stone-200")}>
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink">{a.name}</p>
                      <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                      <Badge>{a.member === "student" ? "Student" : "Community"}</Badge>
                    </div>
                    <p className="truncate text-sm text-muted">{a.email}</p>
                    {a.guest_count > 0 ? (
                      <p className="mt-1 text-sm text-ink">
                        +{a.guest_count} guest{a.guest_count === 1 ? "" : "s"}
                        {a.guest_names ? ` (${a.guest_names})` : ""} ·{" "}
                        <span className={cn("font-semibold", guestsPending ? "text-brand-800" : a.guest_status === "declined" ? "text-red-700" : "text-green-800")}>
                          {a.guest_status === "pending" ? "needs approval" : a.guest_status}
                        </span>
                      </p>
                    ) : null}
                    {a.note ? <p className="mt-1 text-sm text-ink">&ldquo;{a.note}&rdquo;</p> : null}
                    <p className="mt-1 text-xs text-muted">RSVP&apos;d {formatDateTime(a.created_at)}</p>
                  </div>

                  <div className="flex flex-wrap gap-2 md:justify-end">
                    {a.status === "pending" ? (
                      <>
                        <Button size="sm" disabled={busy} onClick={() => run(a.id, () => decideRsvp(eventId, a.id, "approve"))}>
                          Approve
                        </Button>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(a.id, () => decideRsvp(eventId, a.id, "decline"))}>
                          Decline
                        </Button>
                      </>
                    ) : null}
                    {a.status === "waitlist" ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => {
                          if (confirm(`Confirm ${a.name} even though the event is full?`)) run(a.id, () => decideRsvp(eventId, a.id, "approve", true));
                        }}
                      >
                        Confirm anyway (over capacity)
                      </Button>
                    ) : null}
                    {guestsPending && a.status !== "not_going" && a.status !== "declined" ? (
                      <>
                        <Button size="sm" variant="secondary" disabled={busy} onClick={() => run(a.id, () => decideGuests(eventId, a.id, "approve"))}>
                          Approve guests
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(a.id, () => decideGuests(eventId, a.id, "decline"))}>
                          Decline guests
                        </Button>
                      </>
                    ) : null}
                    {a.status === "going" ? (
                      <Button
                        size="md"
                        variant={a.checked_in_at ? "secondary" : "primary"}
                        disabled={busy}
                        aria-pressed={Boolean(a.checked_in_at)}
                        onClick={() => run(a.id, () => setCheckIn(eventId, a.id, !a.checked_in_at))}
                        className="w-full min-w-36 md:w-auto"
                      >
                        {a.checked_in_at ? (
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
