"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Bell, ChevronDown, LayoutDashboard, LogOut, Salad, UserRound } from "lucide-react";

type Props = { displayName: string; email: string; staff: boolean };

/** Account dropdown: closes on outside click, Escape, and navigation. */
export function AccountMenu({ displayName, email, staff }: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const menuId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [lastPath, setLastPath] = useState(pathname);

  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initial = displayName.trim().charAt(0).toUpperCase() || "?";
  const item = "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink hover:bg-stone-100";

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={menuId}
        className="flex items-center gap-1.5 rounded-full p-1 pr-2 hover:bg-stone-100"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">
          {initial}
        </span>
        <span className="sr-only">Account menu for {displayName}</span>
        <ChevronDown className="size-4 text-muted" aria-hidden="true" />
      </button>
      {open ? (
        <div
          id={menuId}
          className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-stone-200 bg-white p-2 shadow-lg"
        >
          <div className="px-3 pb-2 pt-1">
            <p className="truncate text-sm font-semibold text-ink">{displayName}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <div className="my-1 border-t border-stone-100" />
          <Link href="/profile" className={item}>
            <UserRound className="size-4 text-muted" aria-hidden="true" /> Profile
          </Link>
          <Link href="/profile/dietary" className={item}>
            <Salad className="size-4 text-muted" aria-hidden="true" /> Dietary &amp; allergies
          </Link>
          <Link href="/notifications" className={item}>
            <Bell className="size-4 text-muted" aria-hidden="true" /> Notifications
          </Link>
          {staff ? (
            <Link href="/admin" className={item}>
              <LayoutDashboard className="size-4 text-muted" aria-hidden="true" /> Organizer dashboard
            </Link>
          ) : null}
          <div className="my-1 border-t border-stone-100" />
          <form action="/auth/sign-out" method="post">
            <button type="submit" className={`${item} w-full text-left`}>
              <LogOut className="size-4 text-muted" aria-hidden="true" /> Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
