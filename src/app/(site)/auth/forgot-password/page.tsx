"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
    });
    setPending(false);
    if (error && !error.message.toLowerCase().includes("not found")) return setError("Could not send the email. Please try again shortly.");
    setSent(true); // don't reveal whether the account exists
  }

  return (
    <AuthCard title="Reset your password" footer={<Link href="/auth/login" className="link">Back to login</Link>}>
      {sent ? (
        <p className="text-sm text-charcoal-700" role="status">If an account exists for <strong>{email}</strong>, you&apos;ll receive a reset link shortly.</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="fp-email" className="label">Email</label>
            <input id="fp-email" type="email" required autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending && <Spinner />} Send reset link</button>
        </form>
      )}
    </AuthCard>
  );
}
