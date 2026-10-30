"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Spinner } from "@/components/ui/Spinner";
import { safeNext } from "@/lib/safe-redirect";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const target = safeNext(next);

  const done = () => {
    router.replace(target);
    router.refresh();
  };

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const { error } = await createClient().auth.signInWithPassword({ email: email.trim(), password });
    setPending(false);
    if (error) {
      setError(error.message.includes("Email not confirmed") ? "Please verify your email first — check your inbox for the link." : "Incorrect email or password.");
      return;
    }
    done();
  }

  const e164 = () => {
    const d = phone.replace(/\D/g, "");
    return d.length === 10 ? `+91${d}` : `+${d}`;
  };

  async function onPhone(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const supabase = createClient();
    if (!otpSent) {
      const { error } = await supabase.auth.signInWithOtp({ phone: e164() });
      setPending(false);
      if (error) return setError(error.message.includes("provider") ? "Phone login is not enabled yet. Please use email." : error.message);
      setOtpSent(true);
      setInfo("We sent a 6-digit code by SMS.");
      return;
    }
    const { error } = await supabase.auth.verifyOtp({ phone: e164(), token: otp.trim(), type: "sms" });
    setPending(false);
    if (error) return setError("That code is incorrect or has expired.");
    done();
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 rounded-full bg-charcoal/5 p-1 text-sm font-semibold" role="tablist">
        {(["email", "phone"] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} type="button" onClick={() => { setMode(m); setError(null); setInfo(null); }} className={`rounded-full py-2 ${mode === m ? "bg-white shadow-sm" : "text-charcoal-500"}`}>
            {m === "email" ? "Email" : "Mobile OTP"}
          </button>
        ))}
      </div>

      {mode === "email" ? (
        <form onSubmit={onEmail} className="space-y-4">
          <div>
            <label htmlFor="email" className="label">Email</label>
            <input id="email" type="email" autoComplete="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="label">Password</label>
              <Link href="/auth/forgot-password" className="mb-1.5 text-xs font-semibold text-brand-700 hover:underline">Forgot password?</Link>
            </div>
            <input id="password" type="password" autoComplete="current-password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending && <Spinner />} Log in</button>
        </form>
      ) : (
        <form onSubmit={onPhone} className="space-y-4">
          <div>
            <label htmlFor="phone" className="label">Mobile number</label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-xl border border-r-0 border-charcoal/15 bg-charcoal/5 px-3 text-sm">+91</span>
              <input id="phone" inputMode="numeric" autoComplete="tel-national" required pattern="[6-9][0-9]{9}" maxLength={10} className="input rounded-l-none" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} disabled={otpSent} />
            </div>
          </div>
          {otpSent && (
            <div>
              <label htmlFor="otp" className="label">6-digit code</label>
              <input id="otp" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} className="input tracking-[0.4em]" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} />
            </div>
          )}
          {info && <p className="text-sm text-leaf">{info}</p>}
          {error && <p className="field-error" role="alert">{error}</p>}
          <button className="btn-primary w-full" disabled={pending}>{pending && <Spinner />} {otpSent ? "Verify & log in" : "Send code"}</button>
          <p className="hint">Mobile login works once SMS is enabled for this site. New here? Sign up with email first, then add your mobile number.</p>
        </form>
      )}
    </div>
  );
}
