import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/roles";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { RoleChip } from "@/components/admin/people-forms";
import { PersonRoleForm } from "@/components/admin/person-role-form";
import { PersonHistoryView, parsePersonHistory } from "@/components/admin/person-history";

export const metadata: Metadata = { title: "Person" };

const AFFILIATION_LABELS: Record<string, string> = {
  student: "Lehigh student",
  community: "Community member",
  alumni: "Alumni",
  parent: "Parent",
  faculty_staff: "Faculty / staff",
  other: "Other",
};

const isRole = (r: string): r is Role => (ROLES as readonly string[]).includes(r);

// The route is new, so its generated PageProps type appears after the next build.
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const valid = z.guid().safeParse(id).success;
  // Admins only, like People & roles. Check before anything else so others learn nothing.
  await requireRole(["admin"], valid ? `/admin/people/${id}` : "/admin/people");
  if (!valid) notFound();

  const supabase = await createClient();
  const [{ data: person }, history] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, full_name, preferred_name, affiliation, class_year, roles:user_roles!user_roles_user_id_fkey(role)")
      .eq("id", id)
      .maybeSingle(),
    supabase.rpc("get_person_history", { p_user_id: id }),
  ]);
  if (!person) notFound();

  const preferred = person.preferred_name?.trim() || null;
  const full = person.full_name?.trim() || null;
  const name = preferred || full || person.email;
  const roles = (person.roles ?? []).map((r) => r.role).filter(isRole);
  const available = ROLES.filter((r) => !roles.includes(r));
  const details = [
    AFFILIATION_LABELS[person.affiliation],
    person.class_year ? `Class of ${person.class_year}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/people"
          className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to People &amp; roles
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight wrap-anywhere text-ink sm:text-3xl">{name}</h1>
        {preferred && full && full !== preferred ? <p className="mt-1 text-muted">{full}</p> : null}
        <p className="mt-1">
          <a
            href={`mailto:${person.email}`}
            className="inline-flex min-h-11 items-center font-semibold break-all text-brand-700 hover:underline"
          >
            {person.email}
          </a>
        </p>
        {details.length > 0 ? <p className="text-sm text-muted">{details.join(" · ")}</p> : null}
      </div>

      <Card role="region" aria-labelledby="person-roles">
        <CardTitle id="person-roles">Roles</CardTitle>
        {roles.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {roles.map((r) => (
              <RoleChip key={r} userId={person.id} role={r} label={ROLE_LABELS[r]} />
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted">No roles yet.</p>
        )}
        <div className="mt-4">
          <PersonRoleForm email={person.email} available={available} />
        </div>
      </Card>

      {history.error ? (
        <Alert tone="warning" title="We couldn't load their history">
          Please refresh the page in a moment.
        </Alert>
      ) : (
        <PersonHistoryView history={parsePersonHistory(history.data)} />
      )}
    </div>
  );
}
