"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Spinner } from "@/components/ui/Spinner";

export type ActionResult = { ok: boolean; error: string | null; message?: string };
export type FormAction = (prev: ActionResult, form: FormData) => Promise<ActionResult>;

/**
 * Form wrapper for admin server actions. Results are shown inline AND as a
 * floating toast, so errors are visible even at the top of long forms.
 */
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
  const [toast, setToast] = useState<ActionResult | null>(null);

  useEffect(() => {
    if (!state.error && !state.ok) return;
    setToast(state);
    if (state.ok && resetOnSuccess) ref.current?.reset();
    if (state.ok) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
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
      {toast && (toast.error || toast.message) && (
        <div
          role={toast.error ? "alert" : "status"}
          className={`fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-lg items-start gap-3 rounded-2xl px-5 py-4 text-sm font-medium shadow-lift sm:inset-x-auto sm:right-6 ${
            toast.error ? "bg-chilli text-white" : "bg-leaf text-white"
          }`}
        >
          <span className="flex-1">{toast.error ? `Not saved: ${toast.error}` : toast.message}</span>
          <button type="button" onClick={() => setToast(null)} className="font-bold opacity-80 hover:opacity-100" aria-label="Dismiss">✕</button>
        </div>
      )}
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
