import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { hiddenByEventLabel, listShiftsForAdmin, SHIFT_STATUS_LABEL, type AdminShift } from "@/lib/data/volunteer";
import { formatShortDate, formatTimeRange } from "@/lib/time";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = { title: "Volunteers" };

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
] as const;
const STATUS_TONE = { draft: "neutral", open: "green", closed: "amber" } as const;

function ShiftRow({ shift }: { shift: AdminShift }) {
  const full = shift.taken >= shift.slots;
  const hidden = hiddenByEventLabel(shift);
  return (
    <li className="rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[shift.status]}>{SHIFT_STATUS_LABEL[shift.status]}</Badge>
            {full ? <Badge tone="gold">Full</Badge> : null}
            {hidden ? <Badge>{hidden}</Badge> : null}
          </div>
          <p className="mt-1 font-bold text-ink">{shift.title}</p>
          <p className="text-sm text-muted">
            {formatShortDate(shift.starts_at)} · {formatTimeRange(shift.starts_at, shift.ends_at)}
            {" · "}
            <span className="font-semibold text-ink">
              {shift.taken} / {shift.slots} signed up
            </span>
          </p>
          {shift.event ? <p className="text-sm text-muted">For {shift.event.title}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href={`/admin/volunteers/${shift.id}`} variant="secondary">
            Edit &amp; sign-ups<span className="sr-only">: {shift.title}</span>
          </ButtonLink>
        </div>
      </div>
    </li>
  );
}

export default async function AdminVolunteersPage({ searchParams }: PageProps<"/admin/volunteers">) {
  await requireRole(["organizer", "admin"], "/admin/volunteers");
  const params = await searchParams;
  const tab = params.tab === "past" ? "past" : "upcoming";
  const shifts = await listShiftsForAdmin(tab);

  return (
    <div>
      <PageHeader
        title="Volunteers"
        description="Shifts people can sign up for, like cooking, setting up and cleaning up."
        actions={
          <ButtonLink href="/admin/volunteers/new">
            <Plus className="size-4" aria-hidden="true" /> New shift
          </ButtonLink>
        }
      />
      {typeof params.added === "string" && /^\d+$/.test(params.added) ? (
        <Alert tone="success" className="mb-4">
          Added {params.added} weekly shifts. Open one to change it on its own.
        </Alert>
      ) : null}
      {params.deleted ? (
        <Alert tone="success" className="mb-4">
          {params.deleted === "notified" ? "Shift deleted. People signed up get a notification." : "Shift deleted."}
        </Alert>
      ) : null}

      <nav aria-label="Shift lists" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/admin/volunteers?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold",
              tab === t.key ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-ink hover:bg-stone-50",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {shifts.length === 0 ? (
        <EmptyState
          title={tab === "past" ? "No past shifts yet" : "No upcoming shifts"}
          action={tab === "upcoming" ? <ButtonLink href="/admin/volunteers/new">Create a shift</ButtonLink> : undefined}
        >
          {tab === "upcoming" ? "Add a shift and it shows on the Help out page and on its event's page (once the event is published)." : null}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shifts.map((s) => (
            <ShiftRow key={s.id} shift={s} />
          ))}
        </ul>
      )}

      <p className="mt-6 text-sm text-muted">
        People see open shifts on the{" "}
        <Link href="/volunteer" className="font-semibold text-brand-700 hover:underline">
          Help out
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
