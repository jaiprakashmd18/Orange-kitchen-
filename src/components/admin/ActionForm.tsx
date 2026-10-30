"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/Spinner";

export type ActionResult = { ok: boolean; error: string | null; message?: string };
export type FormAction = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

/** Form wrapper for admin server actions: shows errors/success, optional reset. */
export function ActionForm({
  action,
  children,
  className = "",
  resetOnSuccess = false,
  confirmMessage,
}: {
  action: FormAction;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
}) {
  const [state, formAction] = useActionState<ActionResult, FormData>(action, { ok: false, error: null });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirmMessage && !confirm(confirmMessage)) e.preventDefault();
      }}
    >
      {children}
      {state.error && <p className="field-error mt-2 basis-full" role="alert">{state.error}</p>}
      {state.ok && state.message && <p className="mt-2 basis-full text-sm text-leaf" role="status">{state.message}</p>}
    </form>
  );
}

export function SubmitButton({ children, className = "btn-primary", pendingLabel }: { children: React.ReactNode; className?: string; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending && <Spinner />} {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}
