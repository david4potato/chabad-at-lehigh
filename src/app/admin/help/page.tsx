import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { OpenHashDetails } from "@/components/admin/open-hash-details";

export const metadata: Metadata = { title: "Help" };

type Section = { id: string; title: string; who: string; body: ReactNode };

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <Link href={href} className="font-semibold text-brand-700 hover:underline">
    {children}
  </Link>
);

const SECTIONS: Section[] = [
  {
    id: "weekly",
    title: "Your weekly Shabbat dinner routine",
    who: "Organizers",
    body: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          <A href="/admin/events?tab=past">Events → Past</A> → tap <strong>Duplicate for next week</strong> on last week&apos;s dinner. You get a
          draft copy one week later.
        </li>
        <li>
          Check the copy: date, time and capacity. Its menu and volunteer shifts come along as drafts. Then press <strong>Publish</strong>.
        </li>
        <li>
          On the <strong>Menu</strong> tab, check the dishes, tick the preparation confirmation and press <strong>Publish menu</strong>. (Kitchen staff
          can do this part.)
        </li>
        <li>
          Press <strong>Copy event link</strong> at the top of the event and paste it into your group chats. You can also{" "}
          <strong>Invite people</strong> from the Attendees tab, or post an <A href="/admin/announcements">announcement</A>.
        </li>
        <li>
          During the week, if <A href="/admin">Overview</A> shows <strong>RSVPs to approve</strong>, tap it and approve or decline them.
        </li>
        <li>On the day: kitchen staff open the <strong>Dietary</strong> tab and press <strong>Print</strong>.</li>
        <li>At the door: open <strong>Attendees &amp; check-in</strong> on a phone and tap <strong>Check in</strong> as people arrive.</li>
      </ol>
    ),
  },
  {
    id: "events",
    title: "Creating and changing events",
    who: "Organizers",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <A href="/admin/events/new">New event</A> starts as a <strong>Draft</strong> (only staff can see it). Set <strong>Published</strong> when ready.
        </li>
        <li>
          <strong>Capacity</strong>: leave blank for unlimited. When it&apos;s full, new RSVPs join the <strong>waitlist</strong> and are confirmed
          automatically (with a notification) when someone cancels or you raise the capacity.
        </li>
        <li>
          <strong>Who gets confirmed?</strong> &ldquo;Confirm everyone&rdquo; is simplest; the approval options let you check plus-ones, community
          guests, or everyone.
        </li>
        <li>
          To call an event off, set <strong>Status → Cancelled</strong>. Everyone who RSVP&apos;d gets an urgent in-app notification. Changing the time or
          place of a published event notifies them too. (Only admins can delete events.)
        </li>
        <li>
          Cancelled by mistake? Set it back to <strong>Published</strong>. Everyone who RSVP&apos;d or signed up to help is told it&apos;s back on.
        </li>
        <li>
          Once people have RSVP&apos;d, a published event can&apos;t go back to <strong>Draft</strong>. Cancel it instead, so they hear about it.
        </li>
        <li>Times are always Bethlehem, PA time.</li>
      </ul>
    ),
  },
  {
    id: "rsvps",
    title: "RSVPs, guests, waitlist and check-in",
    who: "Organizers",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          The three tiles at the top of <strong>Attendees &amp; check-in</strong> show seats taken, RSVPs that need approval, and how many people are
          checked in. The filters below count who&apos;s going and who&apos;s on the waitlist.
        </li>
        <li>
          <strong>Approve / Decline</strong> a pending RSVP first. If they&apos;re bringing guests, <strong>Approve guests / Decline guests</strong> shows
          up next. People get a notification.
        </li>
        <li>Declined someone by mistake? Open the <strong>Declined</strong> filter and tap <strong>Undo decline</strong>.</li>
        <li>
          Someone wants to bring more guests after theirs were approved? They set guests to 0, save, then add them all again. The guests need approval
          again.
        </li>
        <li><strong>Confirm anyway (over capacity)</strong> lets someone in from the waitlist even when full.</li>
        <li>
          Someone tells you they can&apos;t come? <strong>Cancel RSVP</strong> frees their seat. They get a notification and the waitlist moves up.
        </li>
        <li>
          Under the list, <strong>Email everyone going</strong> opens your email app with everyone in BCC. <strong>Download spreadsheet</strong> gives a
          CSV (no dietary data).
        </li>
        <li>If you check in at least half the people going, only checked-in people count in the stats.</li>
        <li>Allergy details are on the <strong>Dietary</strong> tab, not here.</li>
      </ul>
    ),
  },
  {
    id: "menus",
    title: "Menus and allergens — the safe way to do it",
    who: "Kitchen staff & organizers",
    body: (
      <ol className="list-decimal space-y-2 pl-5">
        <li>
          Add every ingredient in <A href="/admin/ingredients">Ingredients</A> and tick each allergen it contains — check the package label.{" "}
          <strong>Sesame seeds</strong> and <strong>sesame oil</strong> are separate; so are <strong>wheat</strong> and <strong>gluten</strong>.
        </li>
        <li>
          Build dishes in <A href="/admin/dishes">Dishes</A> from those ingredients (including sauces, dressings, oils and toppings). Mark toppings that are
          only on some servings as <strong>optional</strong>. Allergens are worked out from the ingredients automatically.
        </li>
        <li>
          On the event&apos;s <strong>Menu</strong> tab, add dishes. For each one, open <strong>Edit course, preparation and cross-contact</strong> and tick what it
          <strong> may contain</strong> (shared trays, fryer oil, cutting boards, serving spoons) with a short note.
        </li>
        <li>Write the <strong>Kitchen note</strong> — a general statement like &ldquo;shared kitchen that also handles sesame and tree nuts&rdquo;.</li>
        <li>
          Tick <strong>&ldquo;I confirm the ingredients, allergens and cross-contact notes match how this food will actually be prepared&rdquo;</strong> only after
          checking, then <strong>Publish</strong>. Everyone can now see the menu, even before they RSVP.
        </li>
        <li>
          Published menus are frozen. To change one, press <strong>Start a new version</strong>, make the change, write <strong>What changed?</strong>, and tick{" "}
          <strong>urgent</strong> if it affects allergens — everyone who RSVP&apos;d gets notified.
        </li>
        <li>
          Day-of change (e.g. ran out of something)? Use <strong>Post a menu update</strong>; tick <strong>Urgent</strong> if ingredients or allergens changed.
        </li>
        <li>
          Never describe food as &ldquo;safe&rdquo;, &ldquo;allergen-free&rdquo; or guaranteed. Votes and suggestions are only ideas — you choose the menu.
        </li>
      </ol>
    ),
  },
  {
    id: "dietary",
    title: "Dietary information and privacy",
    who: "Kitchen staff & admins",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>The <strong>Dietary</strong> tab shows anonymous counts to organizers. Names next to allergies are visible only to kitchen staff and admins.</li>
        <li>Every time the named report is opened it&apos;s recorded in the audit log. Use it only for preparing food, and don&apos;t share it.</li>
        <li>People who chose not to share are listed as &ldquo;Not shared&rdquo; — ask them directly. Severe allergies and epinephrine are highlighted.</li>
        <li>Guests&apos; needs only appear if the person who RSVP&apos;d wrote them in their meal notes. Those notes show even when the person doesn&apos;t share their own profile.</li>
      </ul>
    ),
  },
  {
    id: "voting",
    title: "Menu voting and suggestions",
    who: "Kitchen staff & organizers",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>On an event&apos;s <strong>Menu</strong> tab → <strong>Menu voting</strong>, add dish options and press <strong>Open voting</strong> (organizers).</li>
        <li>Votes are advisory and never mean a dish suits an allergy. Close voting when you decide.</li>
        <li>
          <A href="/admin/suggestions">Suggestions</A> collects ideas. Set a status, add a note, or use <strong>Create a dish from this</strong>.
        </li>
      </ul>
    ),
  },
  {
    id: "communicate",
    title: "Announcements, invitations and notifications",
    who: "Organizers",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <A href="/admin/announcements">Announcements</A> show on the home page. Write a title and message and press{" "}
          <strong>Post announcement</strong>. Under <strong>More options</strong>: who sees it, <strong>Show from / Hide after</strong> to schedule it,{" "}
          <strong>Pin</strong> to keep it on top and <strong>Mark as important</strong> to highlight it.
        </li>
        <li>
          <strong>Invite people</strong> (event → Attendees tab): paste email addresses. Members get an in-app invitation; for addresses without an
          account, use <strong>Copy event link</strong> and email it yourself. Anyone can also tap <strong>Invite friends</strong> on an event page.
        </li>
        <li>
          The bell notifies people about waitlist spots, approvals, invitations, urgent menu updates, and cancelled, changed or back-on events. No automatic
          emails or texts yet — use{" "}
          <strong>Email everyone going</strong> for reminders.
        </li>
      </ul>
    ),
  },
  {
    id: "volunteers",
    title: "Volunteer shifts",
    who: "Organizers",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <A href="/admin/volunteers/new">Volunteers → New shift</A>: a title (&ldquo;Help cook Shabbat dinner&rdquo;), the time, how many spots, and
          optionally the event it&apos;s for. Or open an event and press <strong>Add a volunteer shift</strong>.
        </li>
        <li>
          <strong>Open</strong> shifts show on the <A href="/volunteer">Help out</A> page and on their event&apos;s page. People sign up with one tap and
          can press <strong>Can&apos;t make it</strong> to free their spot until the shift starts. Sign-ups stop when the shift starts or every spot is taken.
        </li>
        <li>
          A shift for a draft event stays hidden until the event is published. Shifts for a cancelled event are hidden too. The shift list shows a
          label when this happens.
        </li>
        <li>
          <strong>Closed</strong> stops new sign-ups but keeps everyone already signed up. <strong>Draft</strong> hides the shift while you plan, from
          people signed up too.
        </li>
        <li>
          Open a shift to see who signed up (first come, first listed). <strong>Email everyone</strong> opens your email app with them in BCC, handy for a
          reminder the day before. Someone can&apos;t come? Press <strong>Remove</strong> next to their name. They get a notification.
        </li>
        <li>
          If the event is cancelled or moved, people signed up for its shifts get a notification too. Moving an event doesn&apos;t move its shifts, so
          update their times as well. When you change a shift&apos;s time or delete it, people signed up get a notification.
        </li>
      </ul>
    ),
  },
  {
    id: "stats",
    title: "This semester stats",
    who: "Organizers",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          The numbers on <A href="/admin">Overview</A> count published events since the semester started (August 1 or January 1) that have
          already ended. They show totals only, never names.
        </li>
        <li>
          <strong>People who came</strong> counts everyone going. If you checked in at least half the people going, only those checked in count.
        </li>
        <li><strong>New faces</strong> are people whose first event ever was this semester.</li>
        <li><strong>Avg. at Shabbat</strong> is the average per dinner, including approved guests. Dinners nobody came to are left out.</li>
        <li><strong>Volunteer sign-ups</strong> counts sign-ups for shifts that have ended (not drafts or shifts for cancelled events).</li>
      </ul>
    ),
  },
  {
    id: "admin",
    title: "People, roles, settings and the audit log",
    who: "Admins",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <A href="/admin/people">People &amp; roles</A>: type someone&apos;s email and pick a role. It works even before they sign up. Keep{" "}
          <strong>Kitchen staff</strong> and <strong>Admin</strong> to a small, trusted group, and always have at least two admins.
        </li>
        <li>
          <A href="/admin/settings">Settings</A>: contact name, email, phone, address, directions and parking (used on Find Us, the footer and next to every
          menu), and which email domains count as students.
        </li>
        <li><A href="/admin/audit">Audit log</A>: a permanent record of important changes and every view of the named dietary report.</li>
      </ul>
    ),
  },
  {
    id: "help",
    title: "When someone needs help",
    who: "Everyone",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li><strong>&ldquo;I didn&apos;t get the sign-in email.&rdquo;</strong> Check spam; wait a minute and press Resend; use the code instead of the link.</li>
        <li><strong>&ldquo;The link says it expired.&rdquo;</strong> Links work once. Use the code from the newest email, or request a new one.</li>
        <li><strong>&ldquo;I can&apos;t see the dashboard.&rdquo;</strong> An admin needs to give them a role, then they reload the page.</li>
        <li><strong>&ldquo;I want my data removed.&rdquo;</strong> They can delete dietary info or their whole account in <strong>Profile &amp; settings</strong>.</li>
        <li>
          <strong>&ldquo;I want to change my sign-in email.&rdquo;</strong> Only the site owner can, in Supabase → Authentication → Users. If the new
          address is a Lehigh one, an admin then gives them the <strong>Student</strong> role again in People &amp; roles.
        </li>
      </ul>
    ),
  },
];

export default async function HelpPage() {
  const viewer = await requireRole(["organizer", "kitchen_staff", "admin"], "/admin/help");
  // Admin-only pages would just send others back to the dashboard.
  const sections = isAdmin(viewer.roles) ? SECTIONS : SECTIONS.filter((s) => s.who !== "Admins");
  return (
    <div className="mx-auto max-w-3xl">
      <OpenHashDetails />
      <PageHeader title="How to use the dashboard" description="Short, practical guides. Tap a topic to open it." />
      <Alert tone="info" className="mb-6">
        New here? Start with <strong>Your weekly Shabbat dinner routine</strong>. Anything you can&apos;t see in the menu above needs a role from an admin.
      </Alert>
      <nav aria-label="Help topics" className="mb-6 flex flex-wrap gap-2">
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="inline-flex min-h-11 items-center rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold text-ink hover:bg-stone-50">
            {s.title.split(" — ")[0]}
          </a>
        ))}
      </nav>
      <div className="space-y-3">
        {sections.map((s, i) => (
          <details key={s.id} id={s.id} open={i === 0} className="scroll-mt-24 rounded-[var(--radius-card)] border border-stone-200 bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 p-4 sm:p-5">
              <span className="text-base font-bold text-ink">{s.title}</span>
              <Badge tone="brand" className="ml-auto">{s.who}</Badge>
            </summary>
            <div className="border-t border-stone-100 p-4 text-base leading-relaxed text-ink sm:p-5">{s.body}</div>
          </details>
        ))}
      </div>
    </div>
  );
}
