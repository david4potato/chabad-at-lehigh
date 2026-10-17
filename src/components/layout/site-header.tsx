import Link from "next/link";
import { Bell } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { isStaff } from "@/lib/roles";
import { MAIN_NAV } from "@/config/site";
import { buttonClasses } from "@/components/ui/button";
import { Logo } from "./logo";
import { DesktopNavLinks } from "./nav-links";
import { AccountMenu } from "./account-menu";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const viewer = await getViewer();
  const staff = viewer ? isStaff(viewer.roles) : false;
  const navItems = staff ? [...MAIN_NAV, { href: "/admin", label: "Dashboard" }] : MAIN_NAV;
  const unread = viewer?.unreadNotifications ?? 0;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-stone-200/80 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden md:block">
            <DesktopNavLinks items={navItems} />
          </nav>
          <div className="flex items-center gap-1">
            {viewer ? (
              <>
                <Link
                  href="/notifications"
                  className="relative flex size-10 items-center justify-center rounded-full text-muted hover:bg-stone-100 hover:text-ink"
                  aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
                >
                  <Bell className="size-5" aria-hidden="true" />
                  {unread > 0 ? (
                    <span className="absolute right-1 top-1 flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-5 text-white">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  ) : null}
                </Link>
                <AccountMenu displayName={viewer.displayName} email={viewer.email} staff={staff} />
              </>
            ) : (
              <Link href="/sign-in" className={buttonClasses("primary", "sm")}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <MobileNav signedIn={Boolean(viewer)} staff={staff} />
    </>
  );
}
