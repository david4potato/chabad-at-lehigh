"use client";

import { useState, useTransition, type ComponentProps } from "react";
import { CopyPlus } from "lucide-react";
import { duplicateEvent } from "@/app/admin/events/actions";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form-message";

type Props = Pick<ComponentProps<typeof Button>, "variant" | "size" | "className"> & { id: string };

/** One tap: copies the event to the same time next week as a draft, then opens the copy. */
export function DuplicateEventButton({ id, variant = "primary", size = "md", className }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant={variant}
        size={size}
        className={className}
        disabled={pending}
        onClick={() => start(async () => setResult(await duplicateEvent(id)))}
      >
        <CopyPlus className="size-4" aria-hidden="true" />
        {pending ? "Copying…" : "Duplicate for next week"}
      </Button>
      <FormMessage state={result} />
    </div>
  );
}
