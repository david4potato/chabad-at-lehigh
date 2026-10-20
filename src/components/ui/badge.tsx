import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Tone = "neutral" | "brand" | "gold" | "green" | "red" | "amber";

const tones: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-800 border-stone-200",
  brand: "bg-brand-50 text-brand-800 border-brand-200",
  gold: "bg-gold-50 text-gold-800 border-gold-200",
  green: "bg-green-50 text-green-800 border-green-200",
  red: "bg-red-50 text-red-800 border-red-200",
  amber: "bg-amber-50 text-amber-900 border-amber-200",
};

export function Badge({ tone = "neutral", className, ...props }: ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
