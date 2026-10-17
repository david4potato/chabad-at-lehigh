import { Lock } from "lucide-react";

export function DietaryPrivacyCard() {
  return (
    <div className="rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 p-5 text-sm text-brand-950">
      <p className="flex items-center gap-2 text-base font-bold">
        <Lock className="size-4" aria-hidden="true" /> Your dietary information is private
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5 leading-relaxed">
        <li>You can see and change it any time.</li>
        <li>
          Kitchen staff and admins see it only for events you RSVP to, only to prepare food — and every view is logged.
        </li>
        <li>Organizers see anonymous counts (like &ldquo;3 people avoid sesame&rdquo;), never your name.</li>
        <li>It is never shown publicly or to other students.</li>
      </ul>
    </div>
  );
}
