"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { canManageEvents, canManageMenus, isAdmin, type Role } from "@/lib/roles";

type Item = { href: string; label: string; show: (roles: Role[]) => boolean };

export const ADMIN_NAV: Item[] = [
  { href: "/admin", label: "Overview", show: () => true },
  { href: "/admin/events", label: "Events", show: (r) => canManageEvents(r) || canManageMenus(r) },
  { href: "/admin/dishes", label: "Dishes", show: canManageMenus },
  { href: "/admin/ingredients", label: "Ingredients", show: canManageMenus },
  { href: "/admin/suggestions", label: "Suggestions", show: canManageMenus },
  { href: "/admin/announcements", label: "Announcements", show: canManageEvents },
  { href: "/admin/people", label: "People & roles", show: isAdmin },
  { href: "/admin/settings", label: "Settings", show: isAdmin },
  { href: "/admin/audit", label: "Audit log", show: isAdmin },
];

/** Horizontal, scrollable section nav for the organizer dashboard. */
export function AdminNav({ roles }: { roles: Role[] }) {
  const pathname = usePathname();
  const items = ADMIN_NAV.filter((i) => i.show(roles));
  return (
    <nav aria-label="Dashboard sections" className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
        {items.map((item) => {
          const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "block rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors",
                  active ? "bg-brand-700 text-white" : "text-muted hover:bg-stone-100 hover:text-ink",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
