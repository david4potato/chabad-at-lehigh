import type { ActionResult } from "@/lib/action-result";
import { Alert } from "./alert";

/** Shows the outcome of a server action (success or error) in an accessible live region. */
export function FormMessage({ state }: { state: ActionResult<unknown> | null | undefined }) {
  if (!state) return null;
  if (state.ok && state.message) return <Alert tone="success">{state.message}</Alert>;
  if (!state.ok) return <Alert tone="danger">{state.error}</Alert>;
  return null;
}
