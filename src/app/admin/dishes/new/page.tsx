import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/card";
import { DishForm } from "@/components/admin/menu/library-forms";

export const metadata: Metadata = { title: "New dish" };

export default async function NewDishPage({ searchParams }: PageProps<"/admin/dishes/new">) {
  await requireRole(["organizer", "kitchen_staff", "admin"], "/admin/dishes/new");
  const params = await searchParams;
  const name = typeof params.name === "string" ? params.name.slice(0, 120) : undefined;
  // Opened from an event's menu (?event=): only used to link back to that menu.
  const eventId = typeof params.event === "string" && /^[0-9a-f-]{36}$/i.test(params.event) ? params.event : null;
  const supabase = await createClient();
  const { data: fromEvent } = eventId ? await supabase.from("events").select("id, title").eq("id", eventId).maybeSingle() : { data: null };
  return (
    <div className="mx-auto max-w-3xl">
      {fromEvent ? (
        <Link href={`/admin/events/${fromEvent.id}/menu`} className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
          ← Back to the {fromEvent.title} menu
        </Link>
      ) : (
        <Link href="/admin/dishes" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline">
          ← All dishes
        </Link>
      )}
      <h1 className="mb-1 mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">New dish</h1>
      <p className="mb-6 text-muted">Create the dish, then add every ingredient — allergens come from the ingredients.</p>
      <Card>
        <DishForm defaultName={name} eventId={fromEvent?.id} />
      </Card>
    </div>
  );
}
