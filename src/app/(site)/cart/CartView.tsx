"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { CartLineItem } from "@/components/cart/CartLineItem";
import { PriceSummary } from "@/components/checkout/PriceSummary";
import { useQuote } from "@/components/checkout/useQuote";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoader } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/Icon";

export function CartView({ signedIn }: { signedIn: boolean }) {
  const cart = useCart();
  const [couponInput, setCouponInput] = useState(cart.coupon_code);
  const { data, error, loading } = useQuote({ lines: cart.lines, fulfillment: "takeaway", coupon_code: cart.coupon_code, enabled: cart.ready });

  if (!cart.ready) return <PageLoader label="Loading your cart…" />;
  if (cart.lines.length === 0) {
    return <EmptyState icon="🛒" title="Your cart is empty" description="Add some freshly prepared favourites from our menu." action={{ href: "/menu", label: "Explore menu" }} />;
  }

  const serverPrice = (id: string, opts: string) => data?.quote.lines.find((l) => l.menu_item_id === id && l.selected_options.map((o) => o.choice).join(", ") === opts)?.unit_price;
  const subtotalPreview = data?.quote.subtotal ?? cart.subtotal;
  const couponApplied = data?.quote.coupon;
  const couponError = cart.coupon_code ? data?.quote.coupon_error : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section className="card p-4 sm:p-6" aria-labelledby="cart-items">
        <div className="flex items-center justify-between">
          <h2 id="cart-items" className="font-sans text-lg font-bold">Items ({cart.count})</h2>
          <Link href="/menu" className="link text-sm">+ Add more</Link>
        </div>
        {error && <p className="mt-3 rounded-xl bg-chilli-50 px-4 py-3 text-sm text-chilli" role="alert">{error}</p>}
        <ul className="divide-y divide-charcoal/5">
          {cart.lines.map((l) => (
            <CartLineItem key={l.key} line={l} serverPrice={serverPrice(l.menu_item_id, l.options_summary)} />
          ))}
        </ul>
        <div className="mt-4">
          <label htmlFor="instructions" className="label">Special instructions for the kitchen</label>
          <textarea id="instructions" rows={2} maxLength={500} className="input" placeholder="e.g. less spicy, no onions" value={cart.special_instructions} onChange={(e) => cart.setInstructions(e.target.value)} />
        </div>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-28 lg:h-fit">
        <div className="card p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              cart.setCoupon(couponInput);
            }}
            className="flex gap-2"
          >
            <label htmlFor="coupon" className="sr-only">Coupon code</label>
            <div className="relative flex-1">
              <Icon name="tag" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-charcoal-400" />
              <input id="coupon" className="input pl-9 uppercase" placeholder="Coupon code" value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} maxLength={30} />
            </div>
            {cart.coupon_code ? (
              <button type="button" className="btn-secondary" onClick={() => { cart.setCoupon(""); setCouponInput(""); }}>Remove</button>
            ) : (
              <button type="submit" className="btn-secondary" disabled={!couponInput}>Apply</button>
            )}
          </form>
          {couponApplied && <p className="mt-2 text-sm font-semibold text-leaf">“{couponApplied.code}” applied</p>}
          {couponError && <p className="field-error">{couponError}</p>}
          {cart.coupon_code && !signedIn && <p className="hint">Coupon limits are checked again when you log in.</p>}
        </div>

        <div className="card p-5">
          <h2 className="mb-2 font-sans text-lg font-bold">Bill summary</h2>
          <PriceSummary data={data ? { ...data, delivery_pending: true } : null} fallbackSubtotal={subtotalPreview} />
          <p className="hint mt-2">Delivery charges (if any) are added at checkout based on your address.</p>
          {data?.blockers.filter((b) => !/pickup|takeaway|delivery/i.test(b)).map((b) => (
            <p key={b} className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{b}</p>
          ))}
          <Link href={signedIn ? "/checkout" : "/auth/login?next=/checkout"} className={`btn-primary mt-5 w-full ${loading ? "pointer-events-none opacity-60" : ""}`} aria-disabled={loading}>
            {signedIn ? "Proceed to checkout" : "Log in to checkout"} <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
          <Link href="/menu" className="btn-ghost mt-2 w-full">Continue shopping</Link>
        </div>
      </aside>
    </div>
  );
}
