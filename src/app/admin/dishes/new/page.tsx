import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { DishForm } from "@/components/admin/menu/library-forms";

export const metadata: Metadata = { title: "New dish" };

export default async function NewDishPage({ searchParams }: PageProps<"/admin/dishes/new">) {
  await requireRole(["organizer", "kitchen_staff", "admin"], "/admin/dishes/new");
  const params = await searchParams;
  const name = typeof params.name === "string" ? params.name.slice(0, 120) : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/dishes" className="text-sm font-semibold text-brand-700 hover:underline">
        ← All dishes
      </Link>
      <h1 className="mb-1 mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">New dish</h1>
      <p className="mb-6 text-muted">Create the dish, then add every ingredient — allergens come from the ingredients.</p>
      <Card>
        <DishForm defaultName={name} />
      </Card>
    </div>
  );
}
