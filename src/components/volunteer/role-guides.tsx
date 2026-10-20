import { ChefHat, ChevronDown, Recycle, UtensilsCrossed } from "lucide-react";

/** One short screen per kind of help, so a first-time volunteer knows what to expect. */
const GUIDES = [
  {
    id: "kitchen",
    title: "Kitchen",
    Icon: ChefHat,
    steps: [
      "Wash your hands and tie back long hair before you start.",
      "Follow the cook's kitchen rules, including kosher ones. Not sure about a pot, a utensil or a counter? Ask first.",
      "Use only what's on the recipe. If you add or swap an ingredient, tell the cook so the menu's allergen list stays right.",
      "Keep dishes that contain allergens apart, with their own spoons and boards.",
      "Allergy questions go to the cook or the organizer. Never guess.",
    ],
  },
  {
    id: "setup",
    title: "Setup",
    Icon: UtensilsCrossed,
    steps: [
      "Ask the organizer for the latest RSVP count and set that many places.",
      "Put out water for everyone: pitchers or a refill station, and cups.",
      "Put labeled recycling and compost bins next to the trash.",
      "Keep walkways and doors clear.",
    ],
  },
  {
    id: "cleanup",
    title: "Clean-up",
    Icon: Recycle,
    steps: [
      "Refrigerate leftovers within 2 hours, in containers labeled with the dish, the date and what it contains.",
      "Recycle cans, bottles and cardboard, and compost food scraps where you can.",
      "Wash and reuse trays and containers.",
      "Wipe the tables and put chairs where the organizer asks.",
      "Check with the organizer before you leave.",
    ],
  },
];

export function RoleGuides() {
  return (
    <section aria-labelledby="guides-heading" className="mt-12">
      <h2 id="guides-heading" className="text-lg font-bold text-ink">
        Quick guides
      </h2>
      <p className="mt-2 text-sm text-muted">What each kind of help involves. The organizer on the day has the final say.</p>
      <div className="mt-4 space-y-3">
        {GUIDES.map(({ id, title, Icon, steps }) => (
          <details key={id} className="group rounded-[var(--radius-card)] border border-stone-200 bg-white px-4 shadow-sm">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 font-semibold text-ink [&::-webkit-details-marker]:hidden">
              <Icon className="size-4 text-gold-700" aria-hidden="true" />
              {title}
              <ChevronDown className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ol className="list-decimal space-y-2 pb-4 pl-6 text-sm text-ink">
              {steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </section>
  );
}
