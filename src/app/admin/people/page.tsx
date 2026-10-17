import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/roles";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { GrantRoleForm, PendingGrantChip, RoleChip } from "@/components/admin/people-forms";

export const metadata: Metadata = { title: "People & roles" };

export default async function PeoplePage({ searchParams }: PageProps<"/admin/people">) {
  await requireRole(["admin"], "/admin/people");
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, email, full_name, preferred_name, affiliation, created_at, roles:user_roles!user_roles_user_id_fkey(role)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (q) {
    // Only letters, numbers and email punctuation reach the filter string.
    const safe = q.replace(/[^\p{L}\p{N}@.\-+' ]/gu, " ").trim();
    query = query.or(`email.ilike.%${safe}%,full_name.ilike.%${safe}%,preferred_name.ilike.%${safe}%`);
  }
  const [{ data: people }, { data: pending }] = await Promise.all([
    query,
    supabase.from("pending_role_grants").select("email, role").order("email"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="People & roles" description="Give people the access they need — and no more." />

      <Card>
        <CardTitle>Give someone a role</CardTitle>
        <p className="mt-1 text-sm text-muted">Works even if they haven&apos;t signed in yet.</p>
        <div className="mt-4">
          <GrantRoleForm />
        </div>
      </Card>

      <Alert tone="info" title="Keep dietary access small">
        Only <strong>Kitchen staff</strong> and <strong>Admins</strong> can see names next to allergies. Give those roles only
        to people who truly need them.
      </Alert>

      <details className="rounded-[var(--radius-card)] border border-stone-200 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-semibold text-ink">What each role can do</summary>
        <dl className="mt-3 space-y-2 text-sm">
          {ROLES.map((r) => (
            <div key={r}>
              <dt className="font-semibold text-ink">{ROLE_LABELS[r]}</dt>
              <dd className="text-muted">{ROLE_DESCRIPTIONS[r]}</dd>
            </div>
          ))}
        </dl>
      </details>

      {(pending ?? []).length > 0 ? (
        <Card>
          <CardTitle>Waiting for first sign-in</CardTitle>
          <ul className="mt-3 space-y-2">
            {(pending ?? []).map((p) => (
              <li key={`${p.email}-${p.role}`} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-ink">{p.email}</span>
                <PendingGrantChip email={p.email} role={p.role as Role} label={ROLE_LABELS[p.role as Role]} />
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardTitle>People</CardTitle>
        <form className="mt-3 flex gap-2" role="search">
          <Input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search people" />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
        <ul className="mt-4 divide-y divide-stone-100">
          {(people ?? []).map((p) => (
            <li key={p.id} className="py-3">
              <p className="font-semibold text-ink">{p.full_name || p.preferred_name || "—"}</p>
              <p className="text-sm text-muted">{p.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(p.roles ?? []).map(({ role }) => (
                  <RoleChip key={role} userId={p.id} role={role as Role} label={ROLE_LABELS[role as Role]} />
                ))}
              </div>
            </li>
          ))}
          {(people ?? []).length === 0 ? <li className="py-4 text-sm text-muted">No one found.</li> : null}
        </ul>
      </Card>
    </div>
  );
}
