"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NavItem } from "@/config/site";

export function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Desktop top navigation links with the current page highlighted. Staff have five links, so on tablets Home
 * (the logo also goes there) waits until 1024px, like the phone tab bar.
 */
export function DesktopNavLinks({ items, hideHomeBelowLg = false }: { items: NavItem[]; hideHomeBelowLg?: boolean }) {
  const pathname = usePathname();
  return (
    <ul className="flex items-center gap-2">
      {items.map((item) => {
        const active = isActivePath(pathname, item.href);
        return (
          <li key={item.href} className={hideHomeBelowLg && item.href === "/" ? "hidden lg:block" : undefined}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-lg px-3 text-[15px] font-semibold whitespace-nowrap transition-colors",
                active ? "bg-brand-50 text-brand-800" : "text-muted hover:bg-stone-100 hover:text-ink",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
