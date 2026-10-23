import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm md:p-6", className)}
      {...props}
    />
  );
}

/** `as` sets the heading level so the card fits the page outline; it looks the same either way. */
export function CardTitle({ as: Heading = "h2", className, ...props }: ComponentProps<"h2"> & { as?: "h2" | "h3" }) {
  return <Heading className={cn("text-lg font-bold text-ink", className)} {...props} />;
}
