import Link from "next/link";
import { cn } from "@/lib/cn";
import { canManageEvents, canManageMenus, type Role } from "@/lib/roles";

export type EventTab = "details" | "attendees" | "menu" | "dietary";

/** Sub-navigation shown at the top of every /admin/events/[id]/* page. */
export function EventTabs({ eventId, active, roles }: { eventId: string; active: EventTab; roles: Role[] }) {
  const tabs: { key: EventTab; href: string; label: string; show: boolean }[] = [
    { key: "details", href: `/admin/events/${eventId}`, label: "Details", show: canManageEvents(roles) },
    { key: "attendees", href: `/admin/events/${eventId}/attendees`, label: "Attendees & check-in", show: canManageEvents(roles) },
    { key: "menu", href: `/admin/events/${eventId}/menu`, label: "Menu", show: canManageMenus(roles) },
    { key: "dietary", href: `/admin/events/${eventId}/dietary`, label: "Dietary", show: canManageEvents(roles) || canManageMenus(roles) },
  ];
  return (
    <nav aria-label="Event sections" className="-mx-4 mb-6 overflow-x-auto border-b border-stone-200 px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <li key={t.key}>
              <Link
                href={t.href}
                aria-current={t.key === active ? "page" : undefined}
                className={cn(
                  "-mb-px flex min-h-11 items-end border-b-2 px-2 pb-3 text-sm font-semibold whitespace-nowrap",
                  t.key === active ? "border-brand-700 text-brand-800" : "border-transparent text-muted hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
