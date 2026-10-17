import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "info" | "success" | "warning" | "danger";

const tones: Record<Tone, { box: string; Icon: typeof Info }> = {
  info: { box: "bg-brand-50 border-brand-200 text-brand-900", Icon: Info },
  success: { box: "bg-green-50 border-green-200 text-green-900", Icon: CheckCircle2 },
  warning: { box: "bg-amber-50 border-amber-300 text-amber-950", Icon: AlertTriangle },
  danger: { box: "bg-red-50 border-red-300 text-red-900", Icon: OctagonAlert },
};

type Props = Omit<ComponentProps<"div">, "title"> & { tone?: Tone; title?: ReactNode };

export function Alert({ tone = "info", title, children, className, role, ...props }: Props) {
  const { box, Icon } = tones[tone];
  return (
    <div
      role={role ?? (tone === "danger" || tone === "warning" ? "alert" : "status")}
      className={cn("flex gap-3 rounded-2xl border p-4 text-sm leading-relaxed", box, className)}
      {...props}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
    </div>
  );
}
