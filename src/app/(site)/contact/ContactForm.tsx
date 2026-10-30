"use client";

import { useActionState } from "react";
import { submitContact, type ContactState } from "./actions";
import { Spinner } from "@/components/ui/Spinner";

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, { ok: false, error: null });
  if (state.ok) {
    return (
      <div className="card p-8 text-center" role="status">
        <p className="text-3xl" aria-hidden>🧡</p>
        <h3 className="mt-3 text-2xl">Thank you!</h3>
        <p className="mt-2 text-charcoal-500">Your message has reached the Orange Kitchen team. We&apos;ll get back to you soon.</p>
      </div>
    );
  }
  return (
    <form action={action} className="card grid gap-4 p-6 sm:p-8" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="label">Name</label>
          <input id="c-name" name="name" required minLength={2} maxLength={120} className="input" autoComplete="name" />
        </div>
        <div>
          <label htmlFor="c-phone" className="label">Mobile (optional)</label>
          <input id="c-phone" name="phone" inputMode="tel" maxLength={15} className="input" autoComplete="tel" />
        </div>
      </div>
      <div>
        <label htmlFor="c-email" className="label">Email</label>
        <input id="c-email" name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label htmlFor="c-msg" className="label">Message</label>
        <textarea id="c-msg" name="message" required minLength={5} maxLength={2000} rows={5} className="input" />
      </div>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      {state.error && <p className="field-error" role="alert">{state.error}</p>}
      <button type="submit" className="btn-primary justify-self-start" disabled={pending}>
        {pending && <Spinner />} Send message
      </button>
    </form>
  );
}
