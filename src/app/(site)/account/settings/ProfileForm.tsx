"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateProfile } from "../actions";
import { Spinner } from "@/components/ui/Spinner";

export function ProfileForm({ initial, email }: { initial: { full_name: string; phone: string; whatsapp_opt_in: boolean; marketing_opt_in: boolean }; email: string }) {
  const [f, setF] = useState({ ...initial, phone: initial.phone.replace(/^\+91/, "") });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="card grid gap-4 p-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await updateProfile(f);
          setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Profile saved." });
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="p-name" className="label">Full name</label>
          <input id="p-name" className="input" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        </div>
        <div>
          <label htmlFor="p-phone" className="label">Mobile number</label>
          <input id="p-phone" className="input" inputMode="numeric" maxLength={13} required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
      </div>
      <div>
        <span className="label">Email</span>
        <p className="text-sm text-charcoal-700">{email}</p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={f.whatsapp_opt_in} onChange={(e) => setF({ ...f, whatsapp_opt_in: e.target.checked })} />
        <span>Send me order updates on WhatsApp</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-600" checked={f.marketing_opt_in} onChange={(e) => setF({ ...f, marketing_opt_in: e.target.checked })} />
        <span>Tell me about offers and new dishes</span>
      </label>
      {msg && <p className={msg.ok ? "text-sm text-leaf" : "field-error"} role="status">{msg.text}</p>}
      <div className="flex flex-wrap gap-3">
        <button className="btn-primary" disabled={pending}>{pending && <Spinner />} Save changes</button>
        <Link href="/auth/reset-password" className="btn-secondary">Change password</Link>
      </div>
    </form>
  );
}
