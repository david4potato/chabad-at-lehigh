import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { canViewDietary } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { getAdminEvent } from "@/lib/data/admin";
import { formatDateTime, formatEventWhen } from "@/lib/time";
import { allergenLabel, dietLabel, SEVERITY_LABELS, type Severity } from "@/lib/allergens";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { EventTabs } from "@/components/admin/event-tabs";
import { AdminEventHeader } from "@/components/admin/event-header";
import { PrintButton } from "@/components/admin/print-button";

export const metadata: Metadata = { title: "Dietary" };

type Summary = {
  attendees: number;
  going: number;
  approved_guests: number;
  not_shared: number;
  /** True for organizers when fewer than 5 people share: the breakdown below is left out. */
  hidden?: boolean;
  with_notes: number | null;
  with_guest_notes: number | null;
  carries_epinephrine: number | null;
  allergens: { code: string; label: string; intolerance: number; allergy: number; severe: number }[];
  diets: { diet: string; count: number }[];
};

const STATUS_LABEL: Record<string, string> = { going: "Going", pending: "Needs approval", waitlist: "Waitlist" };

export default async function DietaryReportPage({ params }: PageProps<"/admin/events/[id]/dietary">) {
  const { id } = await params;
  const viewer = await requireRole(["organizer", "kitchen_staff", "admin"], `/admin/events/${id}/dietary`);
  const event = await getAdminEvent(id);
  const named = canViewDietary(viewer.roles);
  const supabase = await createClient();

  const [{ data: summaryData, error: summaryError }, report] = await Promise.all([
    supabase.rpc("event_dietary_summary", { p_event_id: event.id }),
    named ? supabase.rpc("event_dietary_report", { p_event_id: event.id }) : Promise.resolve({ data: null, error: null }),
  ]);
  const summary = summaryData as Summary | null;
  const people = report.data ?? [];

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <AdminEventHeader event={event} />
        <EventTabs eventId={event.id} active="dietary" roles={viewer.roles} />
      </div>
      {/* Weekly dinners share a title, so the printout carries the date and when it was printed. */}
      <div className="hidden print:block">
        <h1 className="text-3xl font-bold lg:text-[2.5rem] lg:leading-tight print:text-xl">Dietary report — {event.title}</h1>
        <p className="mt-1 text-sm">
          {formatEventWhen(event.starts_at, event.ends_at)} · Printed {formatDateTime(new Date())}. RSVPs can change, so reprint on the day.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-900 ring-1 ring-red-200 max-w-none">
          <Lock className="size-4" aria-hidden="true" /> Confidential — for meal preparation only.{named ? " Every view is logged." : ""}
        </p>
        <PrintButton />
      </div>

      {summaryError || !summary ? (
        <Alert tone="danger">We couldn&apos;t load the dietary summary.</Alert>
      ) : (
        <Card>
          <CardTitle>Summary (no names)</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Includes people going, waitlisted or awaiting approval. Guests&apos; needs appear only if the person who RSVP&apos;d wrote them down.
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["People", summary.attendees],
              ["Approved guests", summary.approved_guests],
              ...(summary.hidden ? [] : [["Carry epinephrine", summary.carries_epinephrine]]),
              ["Chose not to share", summary.not_shared],
            ].map(([label, value]) => (
              <div key={label as string} className="rounded-xl bg-stone-50 p-3">
                <dt className="text-sm font-semibold text-muted">{label}</dt>
                <dd className="text-xl font-extrabold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {summary.not_shared > 0 ? (
            <Alert tone="warning" className="mt-4">
              {summary.not_shared} {summary.not_shared === 1 ? "person" : "people"} chose not to share dietary details. Please ask them directly.
            </Alert>
          ) : null}
          {/* One line per allergen, severe first, so nothing is cut off on a phone. */}
          {summary.hidden ? (
            <p className="mt-6 text-sm text-muted">
              Fewer than 5 people have shared their dietary details, so the counts are hidden to keep them anonymous. Kitchen staff and
              admins see the full report.
            </p>
          ) : summary.allergens.length === 0 ? (
            <p className="mt-6 text-sm text-muted">No allergies shared yet.</p>
          ) : (
            <ul aria-label="Allergen counts by severity" className="mt-6 divide-y divide-stone-100 border-y border-stone-100 text-sm">
              {summary.allergens.map((a) => (
                <li key={a.code} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2">
                  <span className="font-semibold text-ink">{a.label}</span>
                  <span className="text-muted">
                    <span className={a.severe ? "font-bold text-red-800" : ""}>{a.severe} severe</span>
                    {` · ${a.allergy} allergy · ${a.intolerance} intolerance`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {summary.diets.length ? (
            <p className="mt-4 text-sm text-ink">
              <span className="font-semibold">Diets: </span>
              {summary.diets.map((d) => `${dietLabel(d.diet)} (${d.count})`).join(", ")}
            </p>
          ) : null}
          {summary.hidden ? null : (
            <p className="mt-2 text-sm text-muted">
              {summary.with_notes} with notes for the kitchen · {summary.with_guest_notes} with notes about guests
            </p>
          )}
        </Card>
      )}

      {named ? (
        <Card>
          <CardTitle>By person</CardTitle>
          {report.error ? (
            <Alert tone="danger" className="mt-3">We couldn&apos;t load the named report.</Alert>
          ) : people.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No one has RSVP&apos;d yet.</p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {people.map((p) => {
                const allergens = (p.allergens ?? []) as { code: string; severity: Severity; notes: string | null }[];
                const hasInfo = allergens.length || (p.diets ?? []).length || p.other_restrictions || p.notes_for_kitchen || p.meal_preference || p.guest_dietary_notes || p.carries_epinephrine;
                return (
                  <li key={p.user_id} className="py-3 break-inside-avoid">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-ink">{p.full_name}</p>
                      <Badge>{STATUS_LABEL[p.rsvp_status] ?? p.rsvp_status}</Badge>
                      {p.guest_count > 0 ? (
                        <Badge tone={p.guest_status === "approved" ? "gold" : "neutral"}>
                          +{p.guest_count} guest{p.guest_count === 1 ? "" : "s"}
                          {p.guest_status === "approved" ? "" : ` (${p.guest_status})`}
                        </Badge>
                      ) : null}
                      {p.carries_epinephrine ? <Badge tone="red">Carries epinephrine</Badge> : null}
                    </div>
                    {!p.shared ? (
                      <div className="mt-1 space-y-1 text-sm">
                        <p className="font-semibold text-amber-900">Not shared — please contact them directly.</p>
                        {/* Notes about guests are written for the kitchen, so they show even when the person's own profile isn't shared. */}
                        {p.guest_dietary_notes ? <p className="text-ink"><span className="font-semibold">Guests:</span> {p.guest_dietary_notes}</p> : null}
                      </div>
                    ) : !hasInfo ? (
                      <p className="mt-1 text-sm text-muted">No dietary needs listed.</p>
                    ) : (
                      <div className="mt-2 space-y-1 text-sm text-ink">
                        {allergens.length ? (
                          <div className="flex flex-wrap gap-2">
                            {allergens.map((a) => (
                              <Badge key={a.code} tone={a.severity === "severe" ? "red" : a.severity === "allergy" ? "amber" : "neutral"}>
                                {allergenLabel(a.code)} — {SEVERITY_LABELS[a.severity]}
                                {a.notes ? ` (${a.notes})` : ""}
                              </Badge>
                            ))}
                          </div>
                        ) : null}
                        {(p.diets ?? []).length ? <p><span className="font-semibold">Diet:</span> {(p.diets ?? []).map(dietLabel).join(", ")}</p> : null}
                        {p.other_restrictions ? <p><span className="font-semibold">Other:</span> {p.other_restrictions}</p> : null}
                        {p.notes_for_kitchen ? <p><span className="font-semibold">Kitchen notes:</span> {p.notes_for_kitchen}</p> : null}
                        {p.meal_preference ? <p><span className="font-semibold">For this meal:</span> {p.meal_preference}</p> : null}
                        {p.guest_dietary_notes ? <p><span className="font-semibold">Guests:</span> {p.guest_dietary_notes}</p> : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : (
        <Alert tone="info">Names next to dietary needs are visible only to kitchen staff and admins.</Alert>
      )}
    </div>
  );
}
