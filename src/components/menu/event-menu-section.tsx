import Link from "next/link";
import { AlertTriangle, ChefHat, ChevronDown, Info, Vote } from "lucide-react";
import type { Viewer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { matchDishAllergens, type ProfileAllergen, type Severity } from "@/lib/allergens";
import { groupByCourse, optionalOnlyAllergens, parseEventMenu } from "@/lib/menu";
import { formatDateTime, formatLongDate } from "@/lib/time";
import { plural } from "@/components/events/event-utils";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { DishCard } from "./dish-card";
import { AllergenBadges } from "./allergen-badges";
import { MealDisclaimer } from "./meal-disclaimer";
import { OptionVoteButton } from "./vote-buttons";
import { SuggestionForm } from "./suggestion-form";
import { ADVISORY_NOTE, signInHref } from "./menu-helpers";

type MenuEvent = {
  id: string;
  slug: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string | null;
  has_meal: boolean;
  menu_voting_open: boolean;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
};

type OptionRow = {
  dish_id: string;
  note: string | null;
  dish: { id: string; name: string; description: string | null } | null;
};

export async function EventMenuSection({ event, viewer }: { event: MenuEvent; viewer: Viewer | null }) {
  if (!event.has_meal && !event.menu_voting_open) return null;

  const supabase = await createClient();
  const votingOpen = event.menu_voting_open && event.status === "published";
  const [menuRes, allergiesRes, favoritesRes, optionsRes, optionVotesRes] = await Promise.all([
    supabase.rpc("get_event_menu", { p_event_id: event.id }),
    viewer
      ? supabase.from("user_allergens").select("allergen_code, severity").eq("user_id", viewer.id)
      : Promise.resolve({ data: [] as { allergen_code: string; severity: Severity }[] }),
    supabase.rpc("get_dish_vote_counts", {}),
    votingOpen
      ? supabase
          .from("event_menu_options")
          .select("dish_id, note, dish:dishes(id, name, description)")
          .eq("event_id", event.id)
      : Promise.resolve({ data: [] as OptionRow[] }),
    votingOpen ? supabase.rpc("get_dish_vote_counts", { p_event_id: event.id }) : Promise.resolve({ data: [] }),
  ]);

  const menu = parseEventMenu(menuRes.data);
  const profile: ProfileAllergen[] = (allergiesRes.data ?? []).map((a) => ({ code: a.allergen_code, severity: a.severity }));
  const favorites = new Map((favoritesRes.data ?? []).map((v) => [v.dish_id, v]));
  const optionVotes = new Map((optionVotesRes.data ?? []).map((v) => [v.dish_id, v]));
  const options = ((optionsRes.data ?? []) as OptionRow[]).filter((o) => o.dish);

  const items = menu?.items ?? [];
  const matchesByItem = new Map(
    items.map((item) => [
      item.id,
      matchDishAllergens(
        {
          allergens: item.dish.allergens,
          optionalOnly: optionalOnlyAllergens(item.dish),
          crossContact: item.cross_contact_allergens,
        },
        profile,
      ),
    ]),
  );
  const flagged = items.filter((i) => (matchesByItem.get(i.id) ?? []).length > 0);
  const hasSevere = profile.some((p) => p.severity === "severe");
  const urgent = (menu?.updates ?? []).filter((u) => u.is_urgent);
  const otherUpdates = (menu?.updates ?? []).filter((u) => !u.is_urgent);
  const version = menu?.version ?? null;
  const contact = { name: event.contact_name, email: event.contact_email, phone: event.contact_phone };

  return (
    <section id="menu" aria-labelledby="menu-heading" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="menu-heading" className="text-2xl font-extrabold tracking-tight text-ink">
          Menu
        </h2>
        {version ? (
          <p className="text-sm text-muted">
            Version {version.version}
            {version.published_at ? ` · updated ${formatLongDate(version.published_at)}` : null}
          </p>
        ) : null}
      </div>

      {urgent.length > 0 ? (
        <Alert tone="warning" title="Urgent menu update">
          <ul className="space-y-2">
            {urgent.map((u) => (
              <li key={u.id}>
                {u.message} <span className="whitespace-nowrap text-sm opacity-80">({formatDateTime(u.created_at)})</span>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}

      {!version ? (
        <EmptyState title="Menu coming soon">
          Our team will post the dishes, ingredients and allergen details here before the event.
        </EmptyState>
      ) : (
        <>
          <Card className="space-y-3 bg-stone-50/70">
            {version.title ? <p className="text-base font-semibold text-ink">{version.title}</p> : null}
            {version.prep_confirmed_at ? (
              <p className="flex items-start gap-2 text-sm text-ink">
                <ChefHat className="mt-0.5 size-4 shrink-0 text-gold-700" aria-hidden="true" />
                <span>
                  Confirmed by our kitchen on <strong>{formatLongDate(version.prep_confirmed_at)}</strong>. Shared kitchen —
                  cross-contact is possible.
                </span>
              </p>
            ) : null}
            {version.kitchen_notes ? (
              <p className="flex items-start gap-2 text-sm text-ink">
                <Info className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden="true" />
                <span>
                  <span className="font-semibold">Kitchen note: </span>
                  {version.kitchen_notes}
                </span>
              </p>
            ) : null}
            {otherUpdates.length > 0 ? (
              <details className="group text-sm">
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 font-semibold text-brand-700 [&::-webkit-details-marker]:hidden">
                  Menu changes ({otherUpdates.length})
                  <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <ul className="space-y-2 text-muted">
                  {otherUpdates.map((u) => (
                    <li key={u.id}>
                      {u.message} <span className="text-sm">({formatDateTime(u.created_at)})</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Card>

          <PersonalNotice
            signedIn={Boolean(viewer)}
            slug={event.slug}
            hasProfile={profile.length > 0}
            flaggedNames={flagged.map((i) => i.dish.name)}
            hasSevere={hasSevere}
          />

          <div className="space-y-4">
            {groupByCourse(items).map((group) => (
              <div key={group.course}>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">{group.label}</h3>
                <ul className="space-y-3">
                  {group.items.map((item) => (
                    <DishCard
                      key={item.id}
                      item={item}
                      matches={matchesByItem.get(item.id) ?? []}
                      favorite={
                        viewer
                          ? {
                              active: Boolean(favorites.get(item.dish.id)?.voted_by_me),
                              count: favorites.get(item.dish.id)?.votes ?? 0,
                            }
                          : null
                      }
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>

        </>
      )}

      {votingOpen && options.length > 0 ? (
        <Card>
          <CardTitle className="flex items-center gap-2">
            <Vote className="size-5 text-brand-700" aria-hidden="true" /> Help pick the menu
          </CardTitle>
          <p className="mt-1 text-sm text-muted">{ADVISORY_NOTE}</p>
          <ul className="mt-4 divide-y divide-stone-100">
            {options.map((o) => {
              const votes = optionVotes.get(o.dish_id);
              const snapshot = items.find((i) => i.dish.id === o.dish_id)?.dish;
              return (
                <li key={o.dish_id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">{o.dish!.name}</p>
                    {o.dish!.description ? <p className="text-sm text-muted">{o.dish!.description}</p> : null}
                    {o.note ? <p className="text-sm text-muted">{o.note}</p> : null}
                    {snapshot && snapshot.allergens.length > 0 ? (
                      <AllergenBadges codes={snapshot.allergens} className="mt-2" />
                    ) : null}
                  </div>
                  {viewer ? (
                    <OptionVoteButton
                      eventId={event.id}
                      dishId={o.dish_id}
                      dishName={o.dish!.name}
                      initial={{ active: Boolean(votes?.voted_by_me), count: votes?.votes ?? 0 }}
                    />
                  ) : (
                    <span className="shrink-0 text-sm text-muted">{plural(votes?.votes ?? 0, "vote")}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {!viewer ? (
            <p className="mt-2 text-sm">
              <Link href={signInHref(event.slug)} className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline">
                Sign in to vote
              </Link>
            </p>
          ) : null}
          <p className="mt-2 text-sm text-muted">Allergens are confirmed only once a menu is published.</p>
        </Card>
      ) : null}

      <Card>
        <CardTitle>Suggest a dish or ingredient</CardTitle>
        <div className="mt-4">
          {viewer ? (
            <SuggestionForm eventId={event.id} />
          ) : (
            <Link href={signInHref(event.slug)} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
              Sign in to suggest a dish
            </Link>
          )}
        </div>
      </Card>

      <MealDisclaimer contact={contact} />
    </section>
  );
}

function PersonalNotice({
  signedIn,
  slug,
  hasProfile,
  flaggedNames,
  hasSevere,
}: {
  signedIn: boolean;
  slug: string;
  hasProfile: boolean;
  flaggedNames: string[];
  hasSevere: boolean;
}) {
  if (!signedIn) {
    return (
      <p className="text-sm text-muted">
        <Link href={signInHref(slug)} className="font-semibold text-brand-700 hover:underline">
          Sign in and save your allergies
        </Link>{" "}
        to get personal alerts.
      </p>
    );
  }
  if (!hasProfile) {
    return (
      <p className="text-sm text-muted">
        <Link href="/profile/dietary" className="font-semibold text-brand-700 hover:underline">
          Add your allergies
        </Link>{" "}
        (private) to get personal alerts.
      </p>
    );
  }
  if (flaggedNames.length > 0) {
    return (
      <Alert tone={hasSevere ? "danger" : "warning"} title="Heads up for your allergies">
        <p>
          {flaggedNames.length === 1 ? "1 dish matches" : `${flaggedNames.length} dishes match`} your saved allergies:{" "}
          {flaggedNames.join(", ")}. See each dish below.
        </p>
        {hasSevere ? (
          <p className="mt-1 font-semibold">You listed a severe allergy — please contact the organizer before the event.</p>
        ) : null}
      </Alert>
    );
  }
  return (
    <p className="flex items-start gap-2 rounded-xl bg-white px-3 py-3 text-sm text-muted ring-1 ring-stone-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        Nothing listed matches your saved allergies. This is not a guarantee — contact the organizer about serious
        allergies.
      </span>
    </p>
  );
}
