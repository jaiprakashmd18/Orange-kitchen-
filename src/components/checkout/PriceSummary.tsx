import { formatINR } from "@/lib/format";
import type { QuoteResponse } from "./useQuote";

export function PriceSummary({ data, fallbackSubtotal }: { data: QuoteResponse | null; fallbackSubtotal: number }) {
  const q = data?.quote;
  const row = (label: React.ReactNode, value: React.ReactNode, cls = "") => (
    <div className={`flex justify-between gap-4 py-1.5 ${cls}`}>
      <dt>{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
  return (
    <dl className="text-sm">
      {row("Item total", formatINR(q?.subtotal ?? fallbackSubtotal))}
      {q && q.discount_amount > 0 && row(<>Discount {q.coupon && <span className="font-semibold">({q.coupon.code})</span>}</>, <span className="text-leaf">− {formatINR(q.discount_amount)}</span>)}
      {q && q.packaging_charge > 0 && row("Packaging", formatINR(q.packaging_charge))}
      {row("Delivery fee", data?.delivery_pending ? <span className="text-charcoal-500">Select address</span> : q ? (q.delivery_fee === 0 ? "Free" : formatINR(q.delivery_fee)) : "—")}
      {q && q.tax_amount > 0 && row(`${data!.tax_label}${data!.prices_include_tax ? " (included)" : ""}`, formatINR(q.tax_amount))}
      <div className="my-2 border-t border-dashed border-charcoal/15" />
      {row(<span className="text-base font-bold">To pay</span>, <span className="text-base font-bold">{q ? formatINR(q.total_amount) : "—"}</span>)}
    </dl>
  );
}
