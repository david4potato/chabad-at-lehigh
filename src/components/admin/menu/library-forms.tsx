"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  addDishIngredient,
  deleteDish,
  deleteIngredient,
  removeDishIngredient,
  reviewSuggestion,
  saveDish,
  saveIngredient,
} from "@/app/admin/dishes/actions";
import { initialActionState, type ActionResult } from "@/lib/action-result";
import { ALLERGENS } from "@/lib/allergens";
import { COURSE_LABELS, COURSE_ORDER } from "@/lib/menu";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { FormMessage } from "@/components/ui/form-message";

type Dish = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  kosher_type: string | null;
  diet_tags: string[];
  status: string;
};

export function DishForm({ dish, defaultName }: { dish?: Dish; defaultName?: string }) {
  const [state, action] = useActionState(saveDish, initialActionState);
  const e = state.ok ? undefined : state.fieldErrors;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={dish?.id ?? ""} />
      <Field label="Dish name" htmlFor="dish-name" errors={e?.name} required>
        <Input id="dish-name" name="name" required minLength={2} maxLength={120} defaultValue={dish?.name ?? defaultName ?? ""} />
      </Field>
      <Field label="Short description" htmlFor="dish-description" errors={e?.description}>
        <Textarea id="dish-description" name="description" rows={2} maxLength={1000} defaultValue={dish?.description ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Course" htmlFor="dish-category">
          <Select id="dish-category" name="category" defaultValue={dish?.category ?? "main"}>
            {COURSE_ORDER.map((c) => (
              <option key={c} value={c}>
                {COURSE_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Kosher type" htmlFor="dish-kosher">
          <Select id="dish-kosher" name="kosher_type" defaultValue={dish?.kosher_type ?? ""}>
            <option value="">Not set</option>
            <option value="meat">Meat</option>
            <option value="dairy">Dairy</option>
            <option value="pareve">Pareve</option>
          </Select>
        </Field>
        <Field label="Status" htmlFor="dish-status" hint="Proposed dishes can be voted on.">
          <Select id="dish-status" name="status" defaultValue={dish?.status ?? "active"}>
            <option value="active">Active</option>
            <option value="proposed">Proposed</option>
            <option value="archived">Archived (hidden)</option>
          </Select>
        </Field>
      </div>
      <div className="flex flex-wrap gap-x-6">
        <Checkbox name="diet_tags" value="vegetarian" label="Vegetarian" defaultChecked={dish?.diet_tags.includes("vegetarian")} />
        <Checkbox name="diet_tags" value="vegan" label="Vegan" defaultChecked={dish?.diet_tags.includes("vegan")} />
      </div>
      <SubmitButton>{dish ? "Save dish" : "Create dish"}</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function AddIngredientForm({ dishId, ingredients }: { dishId: string; ingredients: { id: string; name: string }[] }) {
  const [state, action] = useActionState(addDishIngredient, initialActionState);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && state.message) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="dish_id" value={dishId} />
      <div className="flex gap-2" role="radiogroup" aria-label="Ingredient source">
        {(["existing", "new"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`h-10 rounded-full border px-4 text-sm font-semibold ${mode === m ? "border-brand-700 bg-brand-700 text-white" : "border-stone-300 bg-white"}`}
          >
            {m === "existing" ? "Pick existing" : "Create new"}
          </button>
        ))}
      </div>
      {mode === "existing" ? (
        <Field label="Ingredient" htmlFor="ingredient_id">
          <Select id="ingredient_id" name="ingredient_id" required defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : (
        <div className="space-y-3">
          <Field label="New ingredient name" htmlFor="new_name">
            <Input id="new_name" name="new_name" required maxLength={120} placeholder="e.g. Toasted sesame oil" />
          </Field>
          <fieldset>
            <legend className="text-sm font-semibold text-ink">Allergens it contains</legend>
            <p className="text-xs text-muted">Check the package label. Sesame seeds and sesame oil are separate.</p>
            <div className="mt-2 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
              {ALLERGENS.map((a) => (
                <Checkbox key={a.code} name="new_allergens" value={a.code} label={a.label} />
              ))}
            </div>
          </fieldset>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <Field label="Amount or note" htmlFor="quantity_note" hint="Optional, e.g. “for the topping”">
          <Input id="quantity_note" name="quantity_note" maxLength={120} />
        </Field>
        <Checkbox name="is_optional" label="Optional ingredient" hint="Only on some servings" />
      </div>
      <SubmitButton variant="secondary">Add ingredient</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  return { pending, result, run: (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn())) };
}

export function RemoveIngredientButton({ dishId, ingredientId, name }: { dishId: string; ingredientId: string; name: string }) {
  const { pending, result, run } = useAction();
  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => removeDishIngredient(dishId, ingredientId))}
        className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-red-50 hover:text-red-700"
        aria-label={`Remove ${name}`}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </button>
      {result && !result.ok ? <span role="alert" className="text-xs text-red-700">{result.error}</span> : null}
    </span>
  );
}

export function DeleteDishButton({ dishId }: { dishId: string }) {
  const { pending, result, run } = useAction();
  return (
    <div className="space-y-2">
      <Button
        variant="ghost"
        className="text-red-700 hover:bg-red-50"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this dish permanently?")) run(() => deleteDish(dishId));
        }}
      >
        Delete dish
      </Button>
      <FormMessage state={result} />
    </div>
  );
}

export function IngredientForm({
  ingredient,
}: {
  ingredient?: { id: string; name: string; notes: string | null; allergens: string[] };
}) {
  const [state, action] = useActionState(saveIngredient, initialActionState);
  const del = useAction();
  const formRef = useRef<HTMLFormElement>(null);
  const p = ingredient?.id ?? "new";
  useEffect(() => {
    if (state.ok && state.message && !ingredient) formRef.current?.reset();
  }, [state, ingredient]);

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="id" value={ingredient?.id ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`ing-name-${p}`}>
          <Input id={`ing-name-${p}`} name="name" required maxLength={120} defaultValue={ingredient?.name ?? ""} />
        </Field>
        <Field label="Notes" htmlFor={`ing-notes-${p}`} hint="e.g. label warnings, brand">
          <Input id={`ing-notes-${p}`} name="notes" maxLength={500} defaultValue={ingredient?.notes ?? ""} />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold text-ink">Contains</legend>
        <div className="mt-1 grid grid-cols-2 gap-x-4 sm:grid-cols-3">
          {ALLERGENS.map((a) => (
            <Checkbox key={a.code} name="allergens" value={a.code} label={a.label} defaultChecked={ingredient?.allergens.includes(a.code)} />
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-2">
        <SubmitButton variant={ingredient ? "secondary" : "primary"}>{ingredient ? "Save" : "Add ingredient"}</SubmitButton>
        {ingredient ? (
          <Button
            variant="ghost"
            className="text-red-700 hover:bg-red-50"
            disabled={del.pending}
            onClick={() => {
              if (confirm(`Delete ${ingredient.name}?`)) del.run(() => deleteIngredient(ingredient.id));
            }}
          >
            Delete
          </Button>
        ) : null}
      </div>
      <FormMessage state={state} />
      <FormMessage state={del.result} />
    </form>
  );
}

export function SuggestionReviewForm({ suggestion }: { suggestion: { id: string; status: string; staff_response: string | null } }) {
  const [state, action] = useActionState(reviewSuggestion, initialActionState);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={suggestion.id} />
      <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
        <Field label="Status" htmlFor={`status-${suggestion.id}`}>
          <Select id={`status-${suggestion.id}`} name="status" defaultValue={suggestion.status}>
            <option value="new">New</option>
            <option value="under_review">Under review</option>
            <option value="accepted">Accepted</option>
            <option value="declined">Declined</option>
          </Select>
        </Field>
        <Field label="Staff note (optional)" htmlFor={`resp-${suggestion.id}`}>
          <Input id={`resp-${suggestion.id}`} name="staff_response" maxLength={1000} defaultValue={suggestion.staff_response ?? ""} />
        </Field>
      </div>
      <SubmitButton variant="secondary" size="sm">
        Save
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}
