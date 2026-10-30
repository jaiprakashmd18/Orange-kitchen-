import type { Metadata } from "next";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = {
  title: "Cancellation, Refund, Terms & Privacy",
  description: "Orange Kitchen ordering policies: cancellations, refunds, terms of service and privacy.",
  alternates: { canonical: "/policies" },
};

export default async function PoliciesPage() {
  const s = await getSettings();
  const paragraphs = (t: string | null) => (t ?? "").split(/\n{2,}/).filter(Boolean).map((p, i) => <p key={i}>{p}</p>);
  return (
    <div className="container-page max-w-3xl py-14 sm:py-20">
      <h1 className="text-5xl">Policies</h1>
      <div className="mt-10 space-y-12 leading-relaxed text-charcoal-700">
        <section id="cancellation" className="scroll-mt-28 space-y-3">
          <h2 className="text-3xl">Cancellation</h2>
          {s.cancellation_policy ? paragraphs(s.cancellation_policy) : <p>Please contact the restaurant for cancellation requests.</p>}
        </section>
        <section id="refunds" className="scroll-mt-28 space-y-3">
          <h2 className="text-3xl">Refunds</h2>
          {s.refund_policy ? paragraphs(s.refund_policy) : <p>Please contact the restaurant for refund requests.</p>}
        </section>
        <section id="terms" className="scroll-mt-28 space-y-3">
          <h2 className="text-3xl">Terms of ordering</h2>
          <p>All orders are prepaid online. Cash on delivery is not available. Prices are in Indian Rupees and include or exclude taxes as shown at checkout.</p>
          <p>An order is confirmed only after the payment is verified and the restaurant accepts it. If we cannot accept your order, it is cancelled and refunded in full.</p>
          <p>Delivery is available only to the areas and pincodes listed at checkout. Estimated times are indicative and may vary with traffic and weather.</p>
        </section>
        <section id="privacy" className="scroll-mt-28 space-y-3">
          <h2 className="text-3xl">Privacy</h2>
          <p>We collect your name, contact details and delivery addresses only to process and deliver your orders and to keep you updated about them.</p>
          <p>Payments are processed by Razorpay. We never see or store your card, UPI PIN or bank credentials.</p>
          <p>Your delivery address and phone number are shared only with the delivery partner assigned to your order. You can update or delete saved addresses from your account at any time.</p>
          <p>WhatsApp order updates are sent only if you opt in from your account settings.</p>
        </section>
      </div>
    </div>
  );
}
