import { allergenLabel } from "@/lib/allergens";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { sortAllergens } from "./menu-helpers";

type Props = {
  codes: readonly string[];
  /** "contains" = listed in an ingredient (red). "may_contain" = kitchen cross-contact note (amber). */
  kind?: "contains" | "may_contain";
  /** Allergens that appear only in optional ingredients (marked in text). */
  optionalOnly?: readonly string[];
  /** Visible lead-in, e.g. "Contains:". Defaults depend on kind. Pass null to hide. */
  label?: string | null;
  className?: string;
};

/**
 * A labelled row of allergen badges. The text label always says what the
 * badges mean, so color is never the only signal.
 */
export function AllergenBadges({ codes, kind = "contains", optionalOnly = [], label, className }: Props) {
  if (codes.length === 0) return null;
  const lead = label === undefined ? (kind === "contains" ? "Contains:" : "May contain (cross-contact):") : label;
  const optional = new Set(optionalOnly);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {lead ? <span className="mr-1 text-sm font-semibold text-ink">{lead}</span> : null}
      {sortAllergens(codes).map((code) => (
        <Badge key={code} tone={kind === "contains" ? "red" : "amber"}>
          {allergenLabel(code)}
          {optional.has(code) ? <span className="font-medium">(optional ingredient)</span> : null}
        </Badge>
      ))}
    </div>
  );
}
