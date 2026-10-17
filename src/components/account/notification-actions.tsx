"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteNotification, markAllNotificationsRead } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";

/** Marks everything as read once the page is shown, so the bell count clears. */
export function MarkReadOnView({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!hasUnread) return;
    const t = setTimeout(async () => {
      const result = await markAllNotificationsRead();
      if (result.ok) router.refresh();
    }, 1500);
    return () => clearTimeout(t);
  }, [hasUnread, router]);
  return null;
}

export function MarkAllReadButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await markAllNotificationsRead();
          router.refresh();
        })
      }
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
      disabled={pending}
      onClick={() => start(async () => void (await deleteNotification(id)))}
      className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-stone-100 hover:text-ink"
      aria-label="Delete notification"
    >
      <Trash2 className="size-4" aria-hidden="true" />
    </button>
  );
}
