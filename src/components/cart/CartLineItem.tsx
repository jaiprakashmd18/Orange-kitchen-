"use client";

import { useCart, type CartLine } from "./CartProvider";
import { DishImage } from "@/components/menu/DishImage";
import { VegMark } from "@/components/ui/VegMark";
import { Icon } from "@/components/ui/Icon";
import { formatINR } from "@/lib/format";

export function CartLineItem({ line, serverPrice }: { line: CartLine; serverPrice?: number }) {
  const { setQuantity, remove } = useCart();
  const unit = serverPrice ?? line.unit_price;
  return (
    <li className="flex gap-4 py-4">
      <DishImage src={line.image_url} alt={line.name} className="h-20 w-20 shrink-0 rounded-xl" sizes="80px" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <VegMark veg={line.is_veg} className="mt-1" />
          <div className="min-w-0">
            <p className="font-semibold leading-snug">{line.name}</p>
            {line.options_summary && <p className="text-xs text-charcoal-500">{line.options_summary}</p>}
            <p className="mt-0.5 text-sm text-charcoal-500">{formatINR(unit)} each</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="inline-flex items-center rounded-full border border-charcoal/15">
            <button type="button" onClick={() => setQuantity(line.key, line.quantity - 1)} className="flex h-9 w-9 items-center justify-center" aria-label={`Decrease ${line.name}`}>
              <Icon name="minus" className="h-4 w-4" />
            </button>
            <span className="w-6 text-center text-sm font-bold" aria-live="polite">{line.quantity}</span>
            <button type="button" onClick={() => setQuantity(line.key, line.quantity + 1)} disabled={line.quantity >= line.max_per_order} className="flex h-9 w-9 items-center justify-center disabled:opacity-40" aria-label={`Increase ${line.name}`}>
              <Icon name="plus" className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-bold">{formatINR(unit * line.quantity)}</span>
            <button type="button" onClick={() => remove(line.key)} className="text-charcoal-400 hover:text-chilli" aria-label={`Remove ${line.name}`}>
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}
