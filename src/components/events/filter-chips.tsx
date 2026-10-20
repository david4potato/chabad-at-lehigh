import Link from "next/link";
import { cn } from "@/lib/cn";

export type FilterChip = { label: string; href: string; active: boolean };

/** A row of link "chips" (one active), scrollable sideways on small screens. */
export function FilterChips({ label, items, className }: { label: string; items: FilterChip[]; className?: string }) {
  return (
    <nav aria-label={label} className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", className)}>
      <ul className="flex w-max gap-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              prefetch={false}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "focus-inset inline-flex h-11 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap transition-colors",
                item.active
                  ? "border-brand-700 bg-brand-700 text-white"
                  : "border-stone-300 bg-white text-ink hover:bg-stone-50",
              )}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
