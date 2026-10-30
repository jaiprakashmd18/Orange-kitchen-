"use client";

import { useState } from "react";
import type { OptionGroup } from "@/lib/types";
import { slugify } from "@/lib/validation";

/** Structured editor for dish customisation groups, serialised to a hidden JSON field. */
export function OptionsEditor({ name, initial }: { name: string; initial: OptionGroup[] }) {
  const [groups, setGroups] = useState<OptionGroup[]>(initial);
  const update = (gi: number, patch: Partial<OptionGroup>) => setGroups((gs) => gs.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const uid = (label: string, taken: string[]) => {
    const base = slugify(label).replace(/-/g, "_").slice(0, 30) || "opt";
    let id = base;
    for (let n = 2; taken.includes(id); n++) id = `${base}_${n}`;
    return id;
  };
  return (
    <div className="space-y-4">
      <input type="hidden" name={name} value={JSON.stringify(groups)} />
      {groups.map((g, gi) => (
        <div key={gi} className="rounded-xl border border-charcoal/10 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]">
            <input className="input" placeholder="Group name, e.g. Spice level" value={g.name} onChange={(e) => update(gi, { name: e.target.value, id: g.id || uid(e.target.value, groups.map((x) => x.id)) })} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-brand-600" checked={g.required} onChange={(e) => update(gi, { required: e.target.checked })} /> Required</label>
            <label className="flex items-center gap-2 text-sm">Max <input type="number" min={1} max={20} className="input w-16" value={g.max} onChange={(e) => update(gi, { max: Math.max(1, Number(e.target.value) || 1) })} /></label>
            <button type="button" className="btn-ghost btn-sm text-chilli" onClick={() => setGroups((gs) => gs.filter((_, i) => i !== gi))}>Remove group</button>
          </div>
          <ul className="mt-3 space-y-2">
            {g.choices.map((c, ci) => (
              <li key={ci} className="flex gap-2">
                <input className="input" placeholder="Choice label" value={c.label} onChange={(e) => update(gi, { choices: g.choices.map((x, j) => (j === ci ? { ...x, label: e.target.value, id: x.id || uid(e.target.value, g.choices.map((y) => y.id)) } : x)) })} />
                <input className="input w-28" type="number" min={0} step="0.5" placeholder="+₹" value={c.price_delta} onChange={(e) => update(gi, { choices: g.choices.map((x, j) => (j === ci ? { ...x, price_delta: Number(e.target.value) || 0 } : x)) })} aria-label="Extra price" />
                <button type="button" className="btn-ghost btn-sm" onClick={() => update(gi, { choices: g.choices.filter((_, j) => j !== ci) })} aria-label="Remove choice">✕</button>
              </li>
            ))}
          </ul>
          <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => update(gi, { choices: [...g.choices, { id: "", label: "", price_delta: 0 }] })}>+ Add choice</button>
        </div>
      ))}
      <button type="button" className="btn-secondary btn-sm" onClick={() => setGroups((gs) => [...gs, { id: "", name: "", required: false, max: 1, choices: [{ id: "", label: "", price_delta: 0 }] }])}>
        + Add customisation group
      </button>
      <p className="hint">Leave empty if the dish has no options. Choice IDs are generated automatically.</p>
    </div>
  );
}
