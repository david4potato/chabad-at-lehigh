"use client";

import { useOptimistic, useState, useTransition } from "react";
import { Check, Heart } from "lucide-react";
import { toggleFavorite, toggleOptionVote } from "@/app/meals/actions";
import { cn } from "@/lib/cn";
import { plural } from "@/components/events/event-utils";

type VoteState = { active: boolean; count: number };

function useVote(initial: VoteState, run: () => Promise<{ ok: boolean; error?: string; data?: { active: boolean } }>) {
  const [state, setState] = useState(initial);
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = () =>
    startTransition(async () => {
      setError(null);
      const next = { active: !state.active, count: state.count + (state.active ? -1 : 1) };
      setOptimistic(next);
      const result = await run();
      if (result.ok && result.data) {
        const active = result.data.active;
        setState({ active, count: state.count + (active === state.active ? 0 : active ? 1 : -1) });
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });

  return { state: optimistic, pending, error, toggle };
}

/** Heart toggle for general favorites (advisory). */
export function FavoriteButton({ dishId, dishName, initial }: { dishId: string; dishName: string; initial: VoteState }) {
  const { state, pending, error, toggle } = useVote(initial, () => toggleFavorite(dishId));
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={state.active}
        aria-label={`${state.active ? "Remove" : "Add"} ${dishName} ${state.active ? "from" : "to"} favorites (${state.count})`}
        className={cn(
          "inline-flex h-10 min-w-11 items-center justify-center gap-2 rounded-full border px-3 text-sm font-semibold transition-colors",
          state.active ? "border-red-200 bg-red-50 text-red-700" : "border-stone-200 bg-white text-muted hover:text-ink",
        )}
      >
        <Heart className={cn("size-4", state.active && "fill-current")} aria-hidden="true" />
        <span aria-hidden="true">{state.count}</span>
      </button>
      {error ? <span role="alert" className="mt-1 text-sm text-red-700">{error}</span> : null}
    </span>
  );
}

/** Vote toggle for a proposed menu option on one event (advisory). */
export function OptionVoteButton({
  eventId,
  dishId,
  dishName,
  initial,
}: {
  eventId: string;
  dishId: string;
  dishName: string;
  initial: VoteState;
}) {
  const { state, pending, error, toggle } = useVote(initial, () => toggleOptionVote(eventId, dishId));
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={state.active}
        aria-label={`${state.active ? "Voted" : "Vote"} for ${dishName}, ${plural(state.count, "vote")}`}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors",
          state.active ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white text-ink hover:bg-stone-50",
        )}
      >
        {state.active ? <Check className="size-4" aria-hidden="true" /> : null}
        {state.active ? "Voted" : "Vote"}
        <span className={cn("rounded-full px-2 text-sm", state.active ? "bg-white/20" : "bg-stone-100")} aria-hidden="true">
          {state.count}
        </span>
      </button>
      {error ? <span role="alert" className="mt-1 text-sm text-red-700">{error}</span> : null}
    </span>
  );
}
