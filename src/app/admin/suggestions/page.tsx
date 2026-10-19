import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/time";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SuggestionReviewForm } from "@/components/admin/menu/library-forms";

export const metadata: Metadata = { title: "Suggestions" };

const TABS = [
  { key: "new", label: "New" },
  { key: "under_review", label: "Under review" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
] as const;
const KIND = { dish: "Dish", ingredient: "Ingredient", feedback: "Feedback" } as Record<string, string>;
const LIMIT = 100;

export default async function SuggestionsPage({ searchParams }: PageProps<"/admin/suggestions">) {
  await requireRole(["organizer", "kitchen_staff", "admin"], "/admin/suggestions");
  const params = await searchParams;
  const tab = TABS.find((t) => t.key === params.status)?.key ?? "new";
  const supabase = await createClient();
  const { data } = await supabase
    .from("dish_suggestions")
    .select("id, kind, title, details, status, staff_response, created_at, event:events(title)")
    .eq("status", tab)
    .order("created_at", { ascending: false })
    .limit(LIMIT);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Menu suggestions" description="Ideas from the community. Suggestions are advisory — you decide what goes on the menu." />
      <nav aria-label="Suggestion status" className="-mx-4 mb-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex w-max gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin/suggestions?status=${t.key}`}
              aria-current={t.key === tab ? "page" : undefined}
              className={cn("inline-flex h-10 items-center rounded-full border px-4 text-sm font-semibold", t.key === tab ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white")}
            >
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
      {(data ?? []).length === 0 ? (
        <EmptyState title="Nothing here" />
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((s) => (
            <li key={s.id} className="rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="gold">{KIND[s.kind] ?? s.kind}</Badge>
                <span className="text-xs text-muted">{formatShortDate(s.created_at)}{s.event ? ` · ${s.event.title}` : ""}</span>
              </div>
              <p className="mt-1.5 font-bold text-ink">{s.title}</p>
              {s.details ? <p className="mt-0.5 text-sm text-muted">{s.details}</p> : null}
              {s.kind === "dish" ? (
                <Link href={`/admin/dishes/new?name=${encodeURIComponent(s.title)}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
                  Create a dish from this →
                </Link>
              ) : null}
              <div className="mt-3 border-t border-stone-100 pt-3">
                <SuggestionReviewForm suggestion={s} />
              </div>
            </li>
          ))}
        </ul>
      )}
      {(data ?? []).length === LIMIT ? <p className="mt-4 text-sm text-muted">Showing the newest {LIMIT}.</p> : null}
    </div>
  );
}
