import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Dashboard" } };

// Every admin page and server action ALSO checks roles itself; this layout
// check only keeps non-staff from seeing the dashboard chrome.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const viewer = await requireRole(["organizer", "kitchen_staff", "admin"], "/admin");
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-gold-700">Organizer dashboard</p>
      <AdminNav roles={viewer.roles} />
      {children}
    </div>
  );
}
