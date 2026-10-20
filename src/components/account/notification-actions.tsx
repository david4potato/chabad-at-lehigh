"use client";

import { startTransition, useEffect, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteNotification, markAllNotificationsRead } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";

/**
 * Marks everything as read once the page is shown, so the bell count clears.
 * The action revalidates the layout, so its response already carries the
 * updated bell and list; no extra router.refresh() is needed.
 */
export function MarkReadOnView({ hasUnread }: { hasUnread: boolean }) {
  useEffect(() => {
    if (!hasUnread) return;
    const t = setTimeout(() => startTransition(async () => void (await markAllNotificationsRead())), 1500);
    return () => clearTimeout(t);
  }, [hasUnread]);
  return null;
}

export function MarkAllReadButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      aria-disabled={pending || undefined}
      onClick={() => {
        if (!pending) start(async () => void (await markAllNotificationsRead()));
      }}
    >
      Mark all as read
    </Button>
  );
}

export function DeleteNotificationButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      aria-disabled={pending || undefined}
      onClick={(e) => {
        if (pending) return;
        // The row goes away, so focus moves to the next (or previous) row's delete button, or to the page.
        const row = e.currentTarget.closest("li");
        const next = (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>("button[aria-label='Delete notification']");
        start(async () => {
          await deleteNotification(id);
          (next ?? document.getElementById("main"))?.focus();
        });
      }}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-stone-100 hover:text-ink"
      aria-label="Delete notification"
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  );
}
