export default function Loading() {
  return (
    <div className="space-y-4 py-2" aria-busy="true">
      <span className="sr-only" role="status">
        Loading…
      </span>
      <div className="h-8 w-2/3 max-w-sm animate-pulse rounded-lg bg-stone-200/70" />
      <div className="h-40 animate-pulse rounded-[var(--radius-card)] bg-stone-200/50" />
      <div className="h-24 animate-pulse rounded-[var(--radius-card)] bg-stone-200/40" />
    </div>
  );
}
