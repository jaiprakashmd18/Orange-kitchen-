"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/Spinner";

export function UtrForm({ orderId, initial }: { orderId: string; initial?: string | null }) {
  const router = useRouter();
  const [utr, setUtr] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!/^\d{12}$/.test(utr)) return setError("The UPI transaction ID has 12 digits — copy it from your payment app.");
        setPending(true);
        const res = await fetch(`/api/orders/${orderId}/upi`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ utr }) });
        const body = await res.json().catch(() => ({}));
        setPending(false);
        if (!res.ok) return setError(body.error ?? "Could not submit. Please try again.");
        router.refresh();
      }}
    >
      <label htmlFor="utr" className="label">UPI transaction ID (UTR / UPI Ref No.)</label>
      <input
        id="utr"
        inputMode="numeric"
        autoComplete="off"
        maxLength={12}
        className="input text-lg tracking-[0.2em]"
        placeholder="12-digit number"
        value={utr}
        onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))}
      />
      <p className="hint">GPay: open the payment → “UPI transaction ID”. PhonePe/Paytm: “UTR” or “UPI Ref No.”</p>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button className="btn-primary w-full" disabled={pending}>{pending && <Spinner />} I&apos;ve paid — submit</button>
    </form>
  );
}
