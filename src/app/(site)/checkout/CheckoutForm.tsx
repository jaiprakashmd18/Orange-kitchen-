"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { useCart } from "@/components/cart/CartProvider";
import { useQuote } from "@/components/checkout/useQuote";
import { PriceSummary } from "@/components/checkout/PriceSummary";
import { openCheckout, type PaymentSession } from "@/components/checkout/razorpay";
import { AddressForm } from "@/components/account/AddressForm";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { PageLoader, Spinner } from "@/components/ui/Spinner";
import { VegMark } from "@/components/ui/VegMark";
import { formatClock, formatDate, formatINR, nowInIST } from "@/lib/format";
import type { Address } from "@/lib/types";

interface PickupOption {
  slot_id: string;
  date: string;
  start_time: string;
  end_time: string;
  remaining: number;
}

export interface CheckoutProps {
  addresses: Address[];
  profile: { full_name: string | null; phone: string | null };
  restaurant: { name: string; logo_url: string | null; address: string; maps: string; delivery_enabled: boolean; takeaway_enabled: boolean };
  emailVerified: boolean;
  paymentsReady: boolean;
}

export function CheckoutForm({ addresses: initialAddresses, profile, restaurant, emailVerified, paymentsReady }: CheckoutProps) {
  const router = useRouter();
  const cart = useCart();
  const [fulfillment, setFulfillment] = useState<"delivery" | "takeaway">(restaurant.delivery_enabled ? "delivery" : "takeaway");
  const [addresses, setAddresses] = useState(initialAddresses);
  const [addressId, setAddressId] = useState<string | null>(initialAddresses.find((a) => a.is_default)?.id ?? initialAddresses[0]?.id ?? null);
  const [adding, setAdding] = useState(initialAddresses.length === 0);
  const [slots, setSlots] = useState<PickupOption[] | null>(null);
  const [pickupInstructions, setPickupInstructions] = useState<string | null>(null);
  const [slot, setSlot] = useState<PickupOption | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, error: quoteError, loading } = useQuote({
    lines: cart.lines,
    fulfillment,
    address_id: fulfillment === "delivery" ? addressId : null,
    pickup_slot_id: fulfillment === "takeaway" ? slot?.slot_id : null,
    pickup_date: fulfillment === "takeaway" ? slot?.date : null,
    coupon_code: cart.coupon_code || null,
    enabled: cart.ready,
  });

  useEffect(() => {
    if (fulfillment !== "takeaway" || slots) return;
    fetch("/api/pickup-slots")
      .then((r) => r.json())
      .then((b) => {
        setSlots(b.options ?? []);
        setPickupInstructions(b.pickup_instructions ?? null);
      })
      .catch(() => setSlots([]));
  }, [fulfillment, slots]);

  // A fresh idempotency key for each distinct order payload: retries of the
  // same payload reuse it (no duplicate orders); a changed cart gets a new one.
  const payloadKey = JSON.stringify([cart.lines.map((l) => [l.key, l.quantity]), fulfillment, addressId, slot?.slot_id, slot?.date, cart.coupon_code, cart.special_instructions]);
  const idempotencyKey = useMemo(() => crypto.randomUUID().replace(/-/g, ""), [payloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cart.ready) return <PageLoader label="Preparing checkout…" />;
  if (cart.lines.length === 0) return <EmptyState icon="🛒" title="Your cart is empty" action={{ href: "/menu", label: "Browse the menu" }} />;

  const blockers = data?.blockers ?? [];
  const today = nowInIST().date;
  const slotsByDate = (slots ?? []).reduce<Record<string, PickupOption[]>>((acc, s) => ((acc[s.date] ??= []).push(s), acc), {});
  const canPay =
    paymentsReady &&
    emailVerified &&
    !loading &&
    !!data &&
    blockers.length === 0 &&
    !quoteError &&
    (fulfillment === "delivery" ? !!addressId : !!slot) &&
    !submitting;

  async function pay() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.lines.map((l) => ({ menu_item_id: l.menu_item_id, quantity: l.quantity, selected_options: l.selected_options })),
          fulfillment,
          address_id: fulfillment === "delivery" ? addressId : undefined,
          pickup_slot_id: fulfillment === "takeaway" ? slot?.slot_id : undefined,
          pickup_date: fulfillment === "takeaway" ? slot?.date : undefined,
          coupon_code: cart.coupon_code || undefined,
          special_instructions: cart.special_instructions || undefined,
          idempotency_key: idempotencyKey,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not place your order.");
      const session = body as PaymentSession;
      const outcome = await openCheckout(session, { name: restaurant.name, logo: restaurant.logo_url });
      if (outcome === "paid" || outcome === "pending") {
        cart.clear();
        router.push(`/orders/${session.order_id}?placed=1`);
        return;
      }
      // Dismissed or failed: the order is saved and can be paid from its page.
      router.push(`/orders/${session.order_id}?payment=${outcome}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
      <div className="space-y-6">
        {/* Fulfillment */}
        <section className="card p-5 sm:p-6" aria-labelledby="how">
          <h2 id="how" className="font-sans text-lg font-bold">How would you like your order?</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {([
              { v: "delivery", label: "Home delivery", icon: "bike", enabled: restaurant.delivery_enabled },
              { v: "takeaway", label: "Takeaway / pickup", icon: "bag", enabled: restaurant.takeaway_enabled },
            ] as const).map((o) => (
              <button
                key={o.v}
                type="button"
                disabled={!o.enabled}
                aria-pressed={fulfillment === o.v}
                onClick={() => setFulfillment(o.v)}
                className={clsx("flex flex-col items-start gap-2 rounded-2xl border-2 p-4 text-left transition disabled:opacity-40", fulfillment === o.v ? "border-brand-500 bg-brand-50" : "border-charcoal/10 hover:border-charcoal/25")}
              >
                <Icon name={o.icon} className="h-6 w-6 text-brand-700" />
                <span className="font-bold">{o.label}</span>
                <span className="text-xs text-charcoal-500">{o.enabled ? (o.v === "takeaway" ? "No delivery charge" : "To your doorstep") : "Unavailable now"}</span>
              </button>
            ))}
          </div>
        </section>

        {fulfillment === "delivery" ? (
          <section className="card p-5 sm:p-6" aria-labelledby="addr">
            <div className="flex items-center justify-between">
              <h2 id="addr" className="font-sans text-lg font-bold">Delivery address</h2>
              {!adding && <button type="button" className="link text-sm" onClick={() => setAdding(true)}>+ Add new</button>}
            </div>
            {adding ? (
              <div className="mt-4">
                <AddressForm
                  defaults={{ full_name: profile.full_name ?? "", phone: profile.phone ?? "" }}
                  onSaved={(a) => {
                    setAddresses((xs) => [a, ...xs.filter((x) => x.id !== a.id)]);
                    setAddressId(a.id);
                    setAdding(false);
                  }}
                  onCancel={addresses.length ? () => setAdding(false) : undefined}
                />
              </div>
            ) : (
              <ul className="mt-4 grid gap-3">
                {addresses.map((a) => (
                  <li key={a.id}>
                    <label className={clsx("flex cursor-pointer gap-3 rounded-2xl border-2 p-4", addressId === a.id ? "border-brand-500 bg-brand-50/50" : "border-charcoal/10")}>
                      <input type="radio" name="address" className="mt-1 accent-brand-600" checked={addressId === a.id} onChange={() => setAddressId(a.id)} />
                      <span className="text-sm">
                        <span className="font-bold">{a.label}</span> · {a.full_name} · {a.phone}
                        <span className="block text-charcoal-500">
                          {[a.house, a.street, a.area, a.landmark, a.city, a.pincode].filter(Boolean).join(", ")}
                        </span>
                        {a.delivery_instructions && <span className="block text-xs text-charcoal-500">Note: {a.delivery_instructions}</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {data?.area && <p className="mt-4 text-sm text-leaf">✓ Delivering to {data.area.name} · approx. {data.area.estimated_minutes} min after preparation</p>}
          </section>
        ) : (
          <section className="card p-5 sm:p-6" aria-labelledby="pickup">
            <h2 id="pickup" className="font-sans text-lg font-bold">Pickup time</h2>
            <p className="mt-1 text-sm text-charcoal-500">
              Collect from {restaurant.address}.{" "}
              <a href={restaurant.maps} target="_blank" rel="noopener noreferrer" className="link">Directions</a>
            </p>
            {pickupInstructions && <p className="mt-2 rounded-xl bg-cream px-3 py-2 text-sm">{pickupInstructions}</p>}
            {slots === null ? (
              <PageLoader label="Loading pickup times…" />
            ) : slots.length === 0 ? (
              <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">No pickup slots are available right now. Please try delivery or call us.</p>
            ) : (
              Object.entries(slotsByDate).map(([date, list]) => (
                <fieldset key={date} className="mt-5">
                  <legend className="text-sm font-bold">{date === today ? "Today" : "Tomorrow"} · {formatDate(date)}</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {list.map((s) => {
                      const active = slot?.slot_id === s.slot_id && slot.date === s.date;
                      return (
                        <button key={`${s.date}-${s.slot_id}`} type="button" aria-pressed={active} onClick={() => setSlot(s)} className={clsx("rounded-xl border-2 px-3 py-2.5 text-sm font-semibold", active ? "border-brand-500 bg-brand-50 text-brand-800" : "border-charcoal/10 hover:border-charcoal/25")}>
                          {formatClock(s.start_time)} – {formatClock(s.end_time)}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              ))
            )}
          </section>
        )}
      </div>

      <aside className="lg:sticky lg:top-28 lg:h-fit">
        <div className="card p-5 sm:p-6">
          <h2 className="font-sans text-lg font-bold">Order summary</h2>
          <ul className="mt-3 divide-y divide-charcoal/5 text-sm">
            {cart.lines.map((l) => (
              <li key={l.key} className="flex items-start gap-2 py-2">
                <VegMark veg={l.is_veg} className="mt-0.5" />
                <span className="flex-1">
                  {l.name} × {l.quantity}
                  {l.options_summary && <span className="block text-xs text-charcoal-500">{l.options_summary}</span>}
                </span>
              </li>
            ))}
          </ul>
          {cart.special_instructions && <p className="mt-2 text-xs text-charcoal-500">Kitchen note: {cart.special_instructions}</p>}
          <div className="mt-4">
            <PriceSummary data={data} fallbackSubtotal={cart.subtotal} />
          </div>
          {loading && <p className="mt-2 flex items-center gap-2 text-xs text-charcoal-500"><Spinner className="h-3 w-3" /> Updating total…</p>}

          {(quoteError || blockers.length > 0 || data?.quote.coupon_error || !emailVerified || !paymentsReady) && (
            <ul className="mt-4 space-y-2 text-sm">
              {!paymentsReady && <li className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">Online payments are not active yet. Please call the restaurant to order.</li>}
              {!emailVerified && <li className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">Please verify your email (check your inbox) before placing an order.</li>}
              {quoteError && <li className="rounded-xl bg-chilli-50 px-3 py-2 text-chilli">{quoteError}</li>}
              {blockers.map((b) => <li key={b} className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">{b}</li>)}
              {cart.coupon_code && data?.quote.coupon_error && <li className="rounded-xl bg-amber-50 px-3 py-2 text-amber-900">Coupon: {data.quote.coupon_error} <Link href="/cart" className="underline">Edit</Link></li>}
            </ul>
          )}
          {error && <p className="mt-4 rounded-xl bg-chilli-50 px-3 py-2 text-sm text-chilli" role="alert">{error}</p>}

          <button type="button" className="btn-primary mt-5 w-full py-3 text-base" disabled={!canPay} onClick={pay}>
            {submitting ? <Spinner /> : <Icon name="check" className="h-4 w-4" />}
            {data ? `Pay ${formatINR(data.quote.total_amount)}` : "Pay"}
          </button>
          <p className="mt-3 text-center text-xs text-charcoal-500">
            Secure payment by Razorpay · UPI, cards, net banking. Cash on delivery is not available.
          </p>
          <p className="mt-1 text-center text-xs text-charcoal-500">
            See our <Link href="/policies#cancellation" className="underline">cancellation &amp; refund policy</Link>.
          </p>
        </div>
      </aside>
    </div>
  );
}
