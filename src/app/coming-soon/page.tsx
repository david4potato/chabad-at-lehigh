import type { Metadata } from "next";
import { Camera, ChefHat, GraduationCap, Mail, QrCode, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Coming soon" };

const PLANS: { Icon: typeof Mail; title: string; text: string; badge?: string }[] = [
  { Icon: GraduationCap, title: "Learning programs", text: "Join classes and study groups and see your schedule." },
  { Icon: Camera, title: "Photo gallery", text: "Photos from Shabbat dinners and events, shared by organizers." },
  { Icon: Users, title: "Friends attending", text: "Optionally see which friends are going (opt-in only). Inviting friends already works — tap “Invite friends” on any event." },
  { Icon: Mail, title: "Email and text reminders", text: "Optional reminders before events you RSVP'd to." },
  { Icon: QrCode, title: "QR check-in & walk-ins", text: "Faster check-in at the door, including guests who didn't RSVP." },
  {
    Icon: ChefHat,
    title: "Customized meals & chef integrations",
    text: "Ways to request meals or work with a chef. We're still talking this through with our organizers.",
    badge: "Idea",
  },
];

export default function ComingSoonPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Coming soon"
        description="A few things we hope to add. None of these are available yet."
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {PLANS.map(({ Icon, title, text, badge }) => (
          <li key={title} className="rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm md:p-6">
            <div className="flex items-center justify-between gap-2">
              <Icon className="size-6 text-gold-700" aria-hidden="true" />
              <Badge>{badge ?? "Planned"}</Badge>
            </div>
            <h2 className="mt-3 font-bold text-ink">{title}</h2>
            <p className="mt-1 text-sm text-muted">{text}</p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        Have an idea? Share it with the suggestion form on any event menu, or tell an organizer.
      </p>
    </div>
  );
}
