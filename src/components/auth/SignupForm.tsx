"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { safeNext } from "@/lib/safe-redirect";

export function SignupForm({ next }: { next: string }) {
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const phone = form.phone.replace(/\D/g, "");
    if (form.full_name.trim().length < 2) return setError("Please enter your name.");
    if (!/^[6-9]\d{9}$/.test(phone)) return setError("Enter a valid 10-digit mobile number.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    setPending(true);
    const { error } = await createClient().auth.signUp({
      email: form.email.trim(),
      password: form.password,
      options: {
        data: { full_name: form.full_name.trim(), phone: `+91${phone}` },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
      },
    });
    setPending(false);
    if (error) return setError(error.message.includes("registered") ? "An account with this email already exists. Try logging in." : error.message);
    setSent(true);
  }

  if (sent) {
    return (
      <div className="text-center" role="status">
        <p className="text-4xl" aria-hidden>📬</p>
        <h2 className="mt-3 text-2xl">Verify your email</h2>
        <p className="mt-2 text-sm text-charcoal-500">
          We sent a verification link to <strong>{form.email}</strong>. Open it on this device to activate your account.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="full_name" className="label">Full name</label>
        <input id="full_name" autoComplete="name" required className="input" value={form.full_name} onChange={set("full_name")} />
      </div>
      <div>
        <label htmlFor="su-email" className="label">Email</label>
        <input id="su-email" type="email" autoComplete="email" required className="input" value={form.email} onChange={set("email")} />
      </div>
      <div>
        <label htmlFor="su-phone" className="label">Mobile number</label>
        <div className="flex">
          <span className="inline-flex items-center rounded-l-xl border border-r-0 border-charcoal/15 bg-charcoal/5 px-3 text-sm">+91</span>
          <input id="su-phone" inputMode="numeric" autoComplete="tel-national" maxLength={10} required className="input rounded-l-none" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "") }))} />
        </div>
        <p className="hint">Used for delivery coordination and order updates.</p>
      </div>
      <div>
        <label htmlFor="su-password" className="label">Password</label>
        <input id="su-password" type="password" autoComplete="new-password" minLength={8} required className="input" value={form.password} onChange={set("password")} />
        <p className="hint">At least 8 characters.</p>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending && <Spinner />} Create account</button>
    </form>
  );
}
