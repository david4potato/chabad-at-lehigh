"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, LayoutDashboard, Ticket, UserRound } from "lucide-react";
import { cn } from "@/lib/cn";
import { isActivePath } from "./nav-links";

/** Bottom tab bar on phones. Hidden on tablets/desktop (top nav is used there). */
export function MobileNav({ signedIn, staff }: { signedIn: boolean; staff: boolean }) {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Home", Icon: Home },
    { href: "/events", label: "Events", Icon: CalendarDays },
    { href: "/my-events", label: "My Events", Icon: Ticket },
    signedIn
      ? { href: "/profile", label: "Profile", Icon: UserRound }
      : { href: "/sign-in", label: "Sign in", Icon: UserRound },
    ...(staff ? [{ href: "/admin", label: "Dashboard", Icon: LayoutDashboard }] : []),
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {items.map(({ href, label, Icon }) => {
          const active =
            isActivePath(pathname, href) || (href === "/profile" && pathname.startsWith("/notifications"));
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold",
                  active ? "text-brand-700" : "text-muted",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                    active && "bg-brand-50",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
