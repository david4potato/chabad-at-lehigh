import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 select-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary: "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900 shadow-sm",
  secondary: "bg-white text-ink border border-stone-300 hover:bg-stone-50 active:bg-stone-100",
  ghost: "text-brand-700 hover:bg-brand-50 active:bg-brand-100",
  danger: "bg-red-700 text-white hover:bg-red-800 active:bg-red-900 shadow-sm",
  gold: "bg-gold-400 text-ink hover:bg-gold-500 active:bg-gold-500 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-11 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-13 px-6 text-lg",
};

export function buttonClasses(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

type ButtonProps = ComponentProps<"button"> & { variant?: Variant; size?: Size };

export function Button({ variant = "primary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}

type ButtonLinkProps = ComponentProps<typeof Link> & { variant?: Variant; size?: Size };

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClasses(variant, size, className)} {...props} />;
}
