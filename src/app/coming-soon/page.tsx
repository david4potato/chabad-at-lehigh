import type { Metadata } from "next";
import { CalendarSync, Camera, ChefHat, GraduationCap, HandHeart, Mail, QrCode, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Coming soon" };

const PLANS = [
  { Icon: HandHeart, title: "Volunteer sign-ups", text: "Sign up for shifts like cooking, setup and community projects." },
  { Icon: GraduationCap, title: "Learning programs", text: "Join classes and study groups and see your schedule." },
  { Icon: Camera, title: "Photo gallery", text: "Photos from Shabbat dinners and events, shared by organizers." },
  { Icon: Users, title: "Invitations & friends attending", text: "Invite friends, and optionally see which friends are going (opt-in only)." },
  { Icon: Mail, title: "Email and text reminders", text: "Optional reminders before events you RSVP'd to." },
  { Icon: QrCode, title: "QR check-in & walk-ins", text: "Faster check-in at the door, including guests who didn't RSVP." },
  { Icon: CalendarSync, title: "Calendar subscription", text: "Subscribe once and see every event in your own calendar." },
  { Icon: ChefHat, title: "Customized meals & chef integrations", text: "Not being built yet — we'll explore it with organizers first." },
];

export default function ComingSoonPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Coming soon"
        description="Ideas we're planning for future versions. None of these are available yet."
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {PLANS.map(({ Icon, title, text }) => (
          <li key={title} className="rounded-[var(--radius-card)] border border-stone-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <Icon className="size-6 text-gold-700" aria-hidden="true" />
              <Badge>Planned</Badge>
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
