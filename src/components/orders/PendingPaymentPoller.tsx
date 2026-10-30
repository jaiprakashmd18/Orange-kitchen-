"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** While a payment is being confirmed, re-render every few seconds (server re-checks Razorpay). */
export function PendingPaymentPoller({ everyMs = 6000, maxMs = 180000 }: { everyMs?: number; maxMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started > maxMs) return clearInterval(t);
      router.refresh();
    }, everyMs);
    return () => clearInterval(t);
  }, [router, everyMs, maxMs]);
  return null;
}
