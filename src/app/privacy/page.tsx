import type { Metadata } from "next";
import Link from "next/link";
import { getOrgSettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  const org = await getOrgSettings();
  const sections: { title: string; body: React.ReactNode }[] = [
    {
      title: "What we collect",
      body: (
        <ul className="list-disc space-y-1 pl-6">
          <li>Your email address (to sign you in and send event updates).</li>
          <li>Your name, whether you&apos;re a student or community member, and optionally class year and phone.</li>
          <li>Your RSVPs, guests and notes to organizers.</li>
          <li>Which events you came to (from RSVPs and check-ins).</li>
          <li>Volunteer shifts you sign up for.</li>
          <li>Optional dietary information: allergies, diet, notes for the kitchen, per-event meal notes.</li>
          <li>Dish votes and suggestions.</li>
        </ul>
      ),
    },
    {
      title: "Who can see what",
      body: (
        <ul className="list-disc space-y-1 pl-6">
          <li>Organizers see RSVPs, names and contact details to run events.</li>
          <li>Organizers see who signed up for a volunteer shift and can email them.</li>
          <li>
            Organizers can see who RSVP&apos;d to and checked in at each event, past and upcoming. Only admins see a one-page summary of
            a person&apos;s attendance and volunteering. The numbers on the organizer overview are totals, without names.
          </li>
          <li>
            Your dietary information is visible only to you, and to kitchen staff and admins for events you RSVP to — only
            for preparing food. Every time they open the dietary report it is logged.
          </li>
          <li>Organizers who are not kitchen staff see anonymous allergy counts, never names.</li>
          <li>Nothing about you is shown publicly or to other students. Vote counts are shown without names.</li>
        </ul>
      ),
    },
    {
      title: "Where it's stored",
      body: (
        <p>
          The app is hosted on Vercel, stores data in Supabase (a managed Postgres database) with strict access rules on
          every table, and sends sign-in emails through an email delivery service. We don&apos;t sell your information,
          show ads, or use tracking cookies — only the cookie that keeps you signed in.
        </p>
      ),
    },
    {
      title: "Your choices",
      body: (
        <ul className="list-disc space-y-1 pl-6">
          <li>
            Edit or delete your dietary information any time on{" "}
            <Link href="/profile/dietary" className="font-semibold text-brand-700 hover:underline">
              Dietary &amp; allergies
            </Link>
            , or choose not to share it with the kitchen. Notes you write about your guests&apos; needs for an event
            always go to kitchen staff so they can cook for them.
          </li>
          <li>Update your details on your profile.</li>
          <li>
            Delete your whole account yourself any time on{" "}
            <Link href="/profile" className="font-semibold text-brand-700 hover:underline">
              Profile &amp; settings
            </Link>
            .
          </li>
        </ul>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Privacy" description="Plain-language summary of how we handle your information." />
      <div className="space-y-4">
        {sections.map((s) => (
          <Card key={s.title}>
            <h2 className="text-lg font-bold text-ink">{s.title}</h2>
            <div className="mt-2 text-base leading-relaxed text-ink">{s.body}</div>
          </Card>
        ))}
        <Card>
          <h2 className="text-lg font-bold text-ink">Questions</h2>
          <p className="mt-2 text-base text-ink">
            {org.contact_email ? (
              <>
                Email{" "}
                <a href={`mailto:${org.contact_email}`} className="font-semibold text-brand-700 hover:underline">
                  {org.contact_email}
                </a>
                .
              </>
            ) : (
              "Please contact an organizer."
            )}
          </p>
        </Card>
      </div>
    </div>
  );
}
