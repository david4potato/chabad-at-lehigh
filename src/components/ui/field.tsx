import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "block w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-base text-ink " +
  "placeholder:text-stone-400 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 " +
  "disabled:bg-stone-100 aria-[invalid=true]:border-red-600";

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cn("block text-sm font-semibold text-ink", className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(control, "h-11", className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }: ComponentProps<"textarea">) {
  return <textarea rows={rows} className={cn(control, "min-h-24", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(control, "h-11 pr-8", className)} {...props} />;
}

export function Checkbox({ className, label, hint, ...props }: ComponentProps<"input"> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl p-1">
      <input
        type="checkbox"
        className={cn("mt-0.5 size-5 shrink-0 rounded border-stone-400 accent-brand-700", className)}
        {...props}
      />
      <span className="text-sm leading-snug">
        <span className="font-medium text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Hint({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm text-muted", className)} {...props} />;
}

export function FieldError({ errors, id }: { errors?: string[]; id?: string }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="text-sm font-medium text-red-700">
      {errors[0]}
    </p>
  );
}

/** Label + control + hint + error, with ids wired up for screen readers. */
export function Field({
  label,
  htmlFor,
  hint,
  errors,
  required,
  children,
  className,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  errors?: string[];
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span className="text-red-700" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </Label>
      {children}
      {hint ? <Hint id={`${htmlFor}-hint`}>{hint}</Hint> : null}
      <FieldError errors={errors} id={`${htmlFor}-error`} />
    </div>
  );
}
