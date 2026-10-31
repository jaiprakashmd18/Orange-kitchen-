"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { openCheckout, type PaymentSession } from "@/components/checkout/razorpay";
import { Spinner } from "@/components/ui/Spinner";

export function RetryPaymentButton({ orderId, restaurantName, logo }: { orderId: string; restaurantName: string; logo: string | null }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          try {
            const res = await fetch(`/api/orders/${orderId}/pay`, { method: "POST" });
            const body = await res.json();
            if (!res.ok) throw new Error(body.error ?? "Could not start payment.");
            if (body.method === "upi") return router.push(body.pay_url);
            await openCheckout(body as PaymentSession, { name: restaurantName, logo });
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        {pending && <Spinner />} Complete payment
      </button>
      {error && <p className="field-error mt-2">{error}</p>}
    </div>
  );
}

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        className="btn-secondary text-chilli"
        disabled={pending}
        onClick={async () => {
          if (!confirm("Cancel this order? Your payment will be refunded in full.")) return;
          setPending(true);
          setError(null);
          const res = await fetch(`/api/orders/${orderId}/cancel`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
          const body = await res.json().catch(() => ({}));
          setPending(false);
          if (!res.ok) return setError(body.error ?? "Could not cancel.");
          router.refresh();
        }}
      >
        {pending && <Spinner />} Cancel order
      </button>
      {error && <p className="field-error mt-2">{error}</p>}
    </div>
  );
}
