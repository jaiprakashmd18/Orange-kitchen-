"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getReorderLines } from "@/app/(site)/account/actions";
import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";

export function ReorderButton({ orderId }: { orderId: string }) {
  const { add } = useCart();
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        className="btn-secondary btn-sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await getReorderLines(orderId);
            if (res.error) return setMsg(res.error);
            if (res.lines.length === 0) return setMsg("These dishes aren't available right now.");
            for (const { quantity, ...line } of res.lines) add(line, quantity);
            if (res.skipped) setMsg(`${res.skipped} item(s) are unavailable and were skipped.`);
            router.push("/cart");
          })
        }
      >
        {pending ? <Spinner className="h-3 w-3" /> : <Icon name="refresh" className="h-3.5 w-3.5" />} Reorder
      </button>
      {msg && <span className="mt-1 text-xs text-charcoal-500">{msg}</span>}
    </span>
  );
}
