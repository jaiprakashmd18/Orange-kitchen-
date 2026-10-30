"use client";

// Loads Razorpay Checkout and opens it for a server-created order.

export interface PaymentSession {
  order_id: string;
  order_number: string;
  razorpay_order_id: string;
  amount_paise: number;
  key_id: string;
  prefill: { name: string; email: string; contact: string };
}

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (resp: { error: { metadata?: { payment_id?: string; order_id?: string } } }) => void) => void };
  }
}

let loading: Promise<void> | null = null;
export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error("Could not load the payment window. Check your connection and try again."));
    };
    document.body.appendChild(s);
  });
  return loading;
}

/**
 * Opens checkout. Resolves "paid" only after the server verified the
 * payment; "dismissed" if the customer closed the window; "failed" otherwise.
 */
export async function openCheckout(session: PaymentSession, opts: { name: string; logo?: string | null }): Promise<"paid" | "dismissed" | "failed" | "pending"> {
  await loadRazorpay();
  return new Promise((resolve) => {
    let settled = false;
    const done = (v: "paid" | "dismissed" | "failed" | "pending") => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };
    const rzp = new window.Razorpay!({
      key: session.key_id,
      order_id: session.razorpay_order_id,
      amount: session.amount_paise,
      currency: "INR",
      name: opts.name,
      description: `Order ${session.order_number}`,
      ...(opts.logo ? { image: opts.logo } : {}),
      prefill: session.prefill,
      notes: { order_number: session.order_number },
      theme: { color: "#CC4A0A" },
      retry: { enabled: true, max_count: 3 },
      modal: { ondismiss: () => done("dismissed"), confirm_close: true },
      handler: async (resp: RazorpaySuccess) => {
        try {
          const res = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(resp),
          });
          const body = await res.json().catch(() => ({}));
          done(res.ok && body.confirmed ? "paid" : res.ok ? "pending" : "failed");
        } catch {
          // Network glitch after payment: the webhook will still confirm it.
          done("pending");
        }
      },
    });
    rzp.on("payment.failed", (resp) => {
      const meta = resp.error?.metadata;
      if (meta?.payment_id && meta.order_id) {
        fetch("/api/payments/failed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ razorpay_order_id: meta.order_id, razorpay_payment_id: meta.payment_id }),
        }).catch(() => undefined);
      }
      // Razorpay keeps the modal open for retries; we resolve on dismiss.
    });
    rzp.open();
  });
}
