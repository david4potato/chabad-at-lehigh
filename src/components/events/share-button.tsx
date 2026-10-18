"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";
import { cn } from "@/lib/cn";

/** "Invite friends" (or another label): native share sheet on phones, copy link elsewhere. */
export function ShareButton({ title, path, label = "Invite friends", className }: { title: string; path: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = new URL(path, window.location.origin).toString();
    const text = `Join me at ${title}!`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return; // person closed the share sheet
      }
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <button
      type="button"
      onClick={share}
      className={cn("inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-700 hover:underline", className)}
    >
      {copied ? <Check className="size-4" aria-hidden="true" /> : <Share2 className="size-4" aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Link copied — paste it to a friend" : label}</span>
    </button>
  );
}
