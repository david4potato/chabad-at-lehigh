import type { Metadata } from "next";
import { listAnnouncements } from "@/lib/data/events";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AnnouncementList } from "@/components/events/announcement-list";

export const metadata: Metadata = { title: "Announcements" };

export default async function AnnouncementsPage() {
  const items = await listAnnouncements();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Announcements" description="News and updates from Chabad at Lehigh." />
      {items.length === 0 ? (
        <EmptyState title="No announcements right now">Check back soon.</EmptyState>
      ) : (
        <AnnouncementList items={items} headingLevel={2} />
      )}
    </div>
  );
}
