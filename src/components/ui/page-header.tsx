import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1 text-sm font-semibold text-gold-700">{eyebrow}</p> : null}
        <h1 className="text-3xl font-extrabold tracking-tight text-ink lg:text-[2.5rem] lg:leading-tight">{title}</h1>
        {description ? <p className="mt-3 text-base text-muted md:mt-4">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
