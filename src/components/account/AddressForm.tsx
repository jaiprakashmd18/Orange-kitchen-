"use client";

import { useState, useTransition } from "react";
import { saveAddress } from "@/app/(site)/account/actions";
import { Spinner } from "@/components/ui/Spinner";
import type { Address } from "@/lib/types";

type Fields = Omit<Address, "id" | "user_id">;

export function AddressForm({ initial, defaults, onSaved, onCancel }: { initial?: Address; defaults?: Partial<Fields>; onSaved: (a: Address) => void; onCancel?: () => void }) {
  const [f, setF] = useState<Fields>({
    label: initial?.label ?? "Home",
    full_name: initial?.full_name ?? defaults?.full_name ?? "",
    phone: (initial?.phone ?? defaults?.phone ?? "").replace(/^\+91/, ""),
    house: initial?.house ?? "",
    street: initial?.street ?? "",
    area: initial?.area ?? "",
    landmark: initial?.landmark ?? "",
    city: initial?.city ?? "Chennai",
    state: initial?.state ?? "Tamil Nadu",
    pincode: initial?.pincode ?? "",
    delivery_instructions: initial?.delivery_instructions ?? "",
    is_default: initial?.is_default ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [svc, setSvc] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function checkPincode(pin: string) {
    if (!/^[1-9]\d{5}$/.test(pin)) return setSvc(null);
    const res = await fetch(`/api/serviceability?pincode=${pin}`);
    const body = await res.json().catch(() => null);
    setSvc(body?.serviceable ? `✓ We deliver to ${body.area} (about ${body.estimated_minutes} min)` : "✗ We don't deliver to this pincode yet — you can still save it, or choose takeaway.");
  }

  const field = (k: keyof Fields, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div>
      <label htmlFor={`addr-${k}`} className="label">{label}</label>
      <input id={`addr-${k}`} className="input" value={(f[k] as string) ?? ""} onChange={set(k)} {...props} />
    </div>
  );

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await saveAddress({ ...f, landmark: f.landmark || undefined, delivery_instructions: f.delivery_instructions || undefined }, initial?.id);
          if (res.error || !res.data) return setError(res.error ?? "Could not save.");
          onSaved(res.data);
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {field("full_name", "Full name", { required: true, autoComplete: "name" })}
        {field("phone", "Mobile number", { required: true, inputMode: "numeric", maxLength: 13, autoComplete: "tel-national" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("house", "House / flat number", { required: true, autoComplete: "address-line1" })}
        {field("street", "Street", { required: true, autoComplete: "address-line2" })}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {field("area", "Area", { required: true })}
        {field("landmark", "Landmark (optional)")}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {field("city", "City", { required: true, autoComplete: "address-level2" })}
        {field("state", "State", { required: true, autoComplete: "address-level1" })}
        <div>
          <label htmlFor="addr-pincode" className="label">Pincode</label>
          <input id="addr-pincode" className="input" inputMode="numeric" maxLength={6} required autoComplete="postal-code" value={f.pincode} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setF((s) => ({ ...s, pincode: v })); if (v.length === 6) checkPincode(v); }} />
        </div>
      </div>
      {svc && <p className={`text-sm ${svc.startsWith("✓") ? "text-leaf" : "text-amber-800"}`}>{svc}</p>}
      <div>
        <label htmlFor="addr-instr" className="label">Delivery instructions (optional)</label>
        <textarea id="addr-instr" rows={2} maxLength={300} className="input" placeholder="e.g. Call on arrival, 2nd floor" value={f.delivery_instructions ?? ""} onChange={set("delivery_instructions")} />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="label mb-0">
          Label{" "}
          <select className="input mt-1 w-auto" value={f.label} onChange={(e) => setF((s) => ({ ...s, label: e.target.value }))}>
            <option>Home</option>
            <option>Work</option>
            <option>Other</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.is_default} onChange={(e) => setF((s) => ({ ...s, is_default: e.target.checked }))} className="h-4 w-4 accent-brand-600" /> Make default
        </label>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <div className="flex gap-3">
        <button className="btn-primary" disabled={pending}>{pending && <Spinner />} Save address</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}
