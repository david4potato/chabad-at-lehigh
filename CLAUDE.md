# Chabad at Lehigh — project guide

Mobile-first community hub: events + RSVP, Shabbat dinner RSVP card, menus with
ingredients/allergens, private dietary preferences, dish voting, organizer dashboard.

Read `docs/PHILOSOPHY.md` (when a feature conflicts with it, the feature changes) and `AGENTS.md` (Next.js 16 notes). Docs for this exact Next version live in
`node_modules/next/dist/docs/`.

## Stack and key decisions

- Next.js 16 App Router + TypeScript + Tailwind v4. **`cacheComponents` is OFF** (classic
  dynamic rendering: pages that read cookies are dynamic automatically). Do not add `"use cache"`.
- `src/proxy.ts` (Next 16's name for middleware) refreshes the Supabase session and redirects
  signed-out visitors away from `/admin`, `/my-events`, `/profile`, `/notifications`, `/welcome`.
- Supabase: Auth (email magic link + 6-digit code; a trigger strips passwords), Postgres with RLS on every table, Storage.
- **No service-role key anywhere in the app.** All queries run as the signed-in person with the
  publishable key. Privileged operations are SECURITY DEFINER SQL functions that check roles.
- Business rules (capacity, waitlist, approvals, menu publishing, rate limits, event-change notifications)
  live in SQL (`supabase/migrations/*`). The app calls RPCs; it does not re-implement them. No production
  database existed before launch, so migrations were edited in place; after launch, add new migration files.

## Conventions

- Server Components by default. Data: `const supabase = await createClient()` from
  `@/lib/supabase/server`. Client Components that need Supabase use `@/lib/supabase/client`.
- Auth helpers (`@/lib/auth`): `getViewer()` (cached per request, returns roles + unread count),
  `requireViewer(nextPath)`, `requireRole(roles, nextPath)` for pages, `viewerWithRole(roles)`
  for server actions. **Every staff page AND every staff server action must check roles itself**
  (layouts don't protect server actions). RLS is the final guard.
- Role predicates in `@/lib/roles` mirror SQL: `canManageEvents` (organizer, admin),
  `canManageMenus` (organizer, kitchen_staff, admin), `canViewDietary` (kitchen_staff, admin).
- Server actions: `"use server"` in an `actions.ts` next to the page. Validate input with zod v4
  (`safeParse`), return `ActionResult` from `@/lib/action-result` (use `validationError`,
  `dbErrorMessage`), then `revalidatePath(...)`. Forms are Client Components using
  `useActionState(action, initialActionState)` with `SubmitButton`, `Field`, `FormMessage`.
- Times: always use `@/lib/time` (formats in America/New_York; `siteLocalToUtcIso` /
  `toDateTimeLocalValue` for `<input type="datetime-local">`). Never `toLocaleString()` without a zone.
- Redirect targets from user input go through `safeNextPath` (`@/lib/safe-redirect`).
- Generated DB types: `src/lib/database.types.ts` (`npm run db:types` after schema changes).
- Menu JSON from `get_event_menu()` is typed/parsed in `@/lib/menu`; allergen data/matching in
  `@/lib/allergens`.

## UI rules (keep it calm, simple and human)

- Use primitives in `src/components/ui/*` (Button/ButtonLink, Card, Badge, Alert, Field/Input/
  Textarea/Select/Checkbox, SubmitButton, FormMessage, PageHeader, EmptyState).
- Palette tokens: `brand-*` (blue, actions/links), `gold-*` (warm highlights), `bg-cream`,
  `text-ink`, `text-muted`, `stone-*` neutrals. Cards are `rounded-[var(--radius-card)]` white.
- Mobile-first. Touch targets ≥ 44px (`h-11`). One clear primary action per screen. Short,
  friendly copy. No emoji. Icons from `lucide-react`, always `aria-hidden` with visible text.
- Accessibility: real `<label>`s, `aria-describedby` for hints/errors, visible focus, color is
  never the only signal, headings in order, `aria-live` feedback via `Alert`/`FormMessage`.

## Meal and allergy safety rules (non-negotiable)

- Never label food "safe", "allergen-free", "free of X" or "guaranteed". Votes and ingredient
  lists are never evidence of safety.
- Always distinguish **Contains** (from ingredients) vs **May contain / cross-contact**
  (kitchen-entered) vs **Related** (e.g. sesame oil vs sesame seeds).
- Every menu view shows the meal disclaimer and an easy way to contact the organizer.
- Votes are advisory; staff approve the final menu. Say so wherever voting appears.
- Dietary data is private: only the owner reads it directly. Kitchen staff/admins see named
  data only through `event_dietary_report()` (audited); organizers get anonymous counts via
  `event_dietary_summary()`.

## Commands

- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` (unit)
- `npm run db:start` (local Supabase via Docker) · `npm run db:reset` (migrations + DEMO seed)
- `npm run test:db` (SQL/RLS tests) · `npm run test:e2e` (Playwright, needs local Supabase)

## Working with others (see CONTRIBUTING.md)

- Branch from `main` and open a pull request; CI must pass. Never force-push.
- Never read or print real `.env` files (`.env.example` is fine), deploy, or change the live Supabase database —
  the owner does those. `.claude/settings.json` blocks or asks before most of these.
