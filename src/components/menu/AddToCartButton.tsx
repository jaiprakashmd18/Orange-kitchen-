"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/ui/Icon";
import { VegMark } from "@/components/ui/VegMark";
import { formatINR } from "@/lib/format";
import type { MenuItem, SelectedOptions } from "@/lib/types";

export type PublicDish = Pick<MenuItem, "id" | "name" | "description" | "price" | "image_url" | "is_veg" | "options" | "max_per_order"> & {
  image_source?: MenuItem["image_source"];
};

function summary(dish: PublicDish, selected: SelectedOptions) {
  return dish.options
    .flatMap((g) => (selected[g.id] ?? []).map((id) => g.choices.find((c) => c.id === id)?.label))
    .filter(Boolean)
    .join(", ");
}

export function AddToCartButton({ dish, disabled, disabledLabel = "Unavailable" }: { dish: PublicDish; disabled?: boolean; disabledLabel?: string }) {
  const { add, lines, setQuantity } = useCart();
  const [open, setOpen] = useState(false);
  const hasOptions = dish.options.length > 0;
  const plainLine = !hasOptions ? lines.find((l) => l.key === `${dish.id}#`) : undefined;

  if (disabled || dish.price === null) {
    return <span className="rounded-full bg-charcoal/5 px-3 py-1.5 text-xs font-semibold text-charcoal-500">{disabledLabel}</span>;
  }

  const addPlain = () =>
    add({
      menu_item_id: dish.id,
      name: dish.name,
      image_url: dish.image_url,
      is_veg: Boolean(dish.is_veg),
      unit_price: dish.price!,
      max_per_order: dish.max_per_order,
      selected_options: {},
      options_summary: "",
    });

  if (plainLine) {
    return (
      <div className="inline-flex items-center rounded-full bg-brand-600 text-white shadow-sm" aria-label={`${dish.name} quantity`}>
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-700" onClick={() => setQuantity(plainLine.key, plainLine.quantity - 1)} aria-label="Decrease quantity">
          <Icon name="minus" className="h-4 w-4" />
        </button>
        <span className="min-w-6 text-center text-sm font-bold" aria-live="polite">{plainLine.quantity}</span>
        <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-brand-700 disabled:opacity-40" onClick={() => setQuantity(plainLine.key, plainLine.quantity + 1)} disabled={plainLine.quantity >= dish.max_per_order} aria-label="Increase quantity">
          <Icon name="plus" className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <>
      <button type="button" onClick={() => (hasOptions ? setOpen(true) : addPlain())} className="btn-primary btn-sm px-4" aria-label={`Add ${dish.name} to cart`}>
        <Icon name="plus" className="h-4 w-4" /> Add
      </button>
      {hasOptions && <OptionsDialog dish={dish} open={open} onClose={() => setOpen(false)} onAdd={(selected, qty) => {
        const extra = dish.options.reduce((sum, g) => sum + (selected[g.id] ?? []).reduce((s, id) => s + (g.choices.find((c) => c.id === id)?.price_delta ?? 0), 0), 0);
        add({
          menu_item_id: dish.id,
          name: dish.name,
          image_url: dish.image_url,
          is_veg: Boolean(dish.is_veg),
          unit_price: Math.round((dish.price! + extra) * 100) / 100,
          max_per_order: dish.max_per_order,
          selected_options: selected,
          options_summary: summary(dish, selected),
        }, qty);
        setOpen(false);
      }} />}
    </>
  );
}

function OptionsDialog({ dish, open, onClose, onAdd }: { dish: PublicDish; open: boolean; onClose: () => void; onAdd: (s: SelectedOptions, qty: number) => void }) {
  const [selected, setSelected] = useState<SelectedOptions>(() =>
    Object.fromEntries(dish.options.filter((g) => g.required && g.max === 1).map((g) => [g.id, [g.choices[0].id]])),
  );
  const [qty, setQty] = useState(1);
  const missing = dish.options.filter((g) => g.required && !(selected[g.id]?.length));
  const extra = dish.options.reduce((sum, g) => sum + (selected[g.id] ?? []).reduce((s, id) => s + (g.choices.find((c) => c.id === id)?.price_delta ?? 0), 0), 0);

  const toggle = (groupId: string, choiceId: string, max: number) => {
    setSelected((s) => {
      const cur = s[groupId] ?? [];
      if (max === 1) return { ...s, [groupId]: [choiceId] };
      if (cur.includes(choiceId)) return { ...s, [groupId]: cur.filter((c) => c !== choiceId) };
      if (cur.length >= max) return s;
      return { ...s, [groupId]: [...cur, choiceId] };
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/50 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`opt-${dish.id}`}
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 sm:max-w-md sm:rounded-3xl"
            initial={{ y: 40 }}
            animate={{ y: 0 }}
            exit={{ y: 40 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {dish.is_veg !== null && <VegMark veg={dish.is_veg} />}
                  <h3 id={`opt-${dish.id}`} className="text-xl">{dish.name}</h3>
                </div>
                <p className="mt-1 text-sm text-charcoal-500">{formatINR(dish.price)}</p>
              </div>
              <button type="button" onClick={onClose} className="btn-ghost h-9 w-9 p-0" aria-label="Close"><Icon name="close" /></button>
            </div>
            {dish.options.map((g) => (
              <fieldset key={g.id} className="mt-6">
                <legend className="text-sm font-bold">
                  {g.name} {g.required ? <span className="text-chilli">*</span> : <span className="font-normal text-charcoal-500">(optional{g.max > 1 ? `, up to ${g.max}` : ""})</span>}
                </legend>
                <div className="mt-2 space-y-2">
                  {g.choices.map((c) => {
                    const checked = (selected[g.id] ?? []).includes(c.id);
                    return (
                      <label key={c.id} className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 text-sm transition ${checked ? "border-brand-500 bg-brand-50" : "border-charcoal/10"}`}>
                        <span className="flex items-center gap-3">
                          <input type={g.max === 1 ? "radio" : "checkbox"} name={`${dish.id}-${g.id}`} checked={checked} onChange={() => toggle(g.id, c.id, g.max)} className="accent-brand-600" />
                          {c.label}
                        </span>
                        {c.price_delta > 0 && <span className="text-charcoal-500">+{formatINR(c.price_delta)}</span>}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
            <div className="mt-8 flex items-center gap-3">
              <div className="inline-flex items-center rounded-full border border-charcoal/15">
                <button type="button" className="flex h-11 w-11 items-center justify-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease"><Icon name="minus" className="h-4 w-4" /></button>
                <span className="w-6 text-center font-bold">{qty}</span>
                <button type="button" className="flex h-11 w-11 items-center justify-center" onClick={() => setQty((q) => Math.min(dish.max_per_order, q + 1))} aria-label="Increase"><Icon name="plus" className="h-4 w-4" /></button>
              </div>
              <button type="button" className="btn-primary flex-1" disabled={missing.length > 0} onClick={() => onAdd(selected, qty)}>
                Add · {formatINR(((dish.price ?? 0) + extra) * qty)}
              </button>
            </div>
            {missing.length > 0 && <p className="field-error mt-2">Please choose {missing.map((m) => m.name).join(", ")}.</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
