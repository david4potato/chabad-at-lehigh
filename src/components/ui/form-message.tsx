import type { ActionResult } from "@/lib/action-result";
import { Alert } from "./alert";

/**
 * Shows the outcome of a server action (success or error). The live region stays in the page even when empty,
 * so screen readers announce the message when it appears.
 */
export function FormMessage({ state }: { state: ActionResult<unknown> | null | undefined }) {
  const message = !state ? null : state.ok ? state.message : state.error;
  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="empty:absolute">
      {message ? (
        <Alert role="none" tone={state?.ok ? "success" : "danger"}>
          {message}
        </Alert>
      ) : null}
    </div>
  );
}
