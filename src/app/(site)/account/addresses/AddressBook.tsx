"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AddressForm } from "@/components/account/AddressForm";
import { deleteAddress, setDefaultAddress } from "../actions";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { Address } from "@/lib/types";

export function AddressBook({ addresses, defaults }: { addresses: Address[]; defaults: { full_name: string; phone: string } }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    setEditing(null);
    router.refresh();
  };
  return (
    <div className="space-y-4">
      {editing ? (
        <div className="card p-5 sm:p-6">
          <h2 className="mb-4 font-sans text-lg font-bold">{editing === "new" ? "Add address" : "Edit address"}</h2>
          <AddressForm initial={editing === "new" ? undefined : editing} defaults={defaults} onSaved={done} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <button type="button" className="btn-primary" onClick={() => setEditing("new")}>+ Add new address</button>
      )}
      {error && <p className="field-error">{error}</p>}
      {addresses.length === 0 && !editing ? (
        <EmptyState icon="📍" title="No saved addresses" description="Save your home or office address for faster checkout." />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="card p-5">
              <div className="flex items-center gap-2">
                <span className="font-bold">{a.label}</span>
                {a.is_default && <Badge tone="info">Default</Badge>}
              </div>
              <p className="mt-2 text-sm">{a.full_name} · {a.phone}</p>
              <p className="text-sm text-charcoal-500">{[a.house, a.street, a.area, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", ")}</p>
              {a.delivery_instructions && <p className="mt-1 text-xs text-charcoal-500">Note: {a.delivery_instructions}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setEditing(a)}>Edit</button>
                {!a.is_default && (
                  <button type="button" className="btn-ghost btn-sm" disabled={pending} onClick={() => start(async () => { const r = await setDefaultAddress(a.id); if (r.error) setError(r.error); router.refresh(); })}>Make default</button>
                )}
                <button type="button" className="btn-ghost btn-sm text-chilli" disabled={pending} onClick={() => confirm("Delete this address?") && start(async () => { const r = await deleteAddress(a.id); if (r.error) setError(r.error); router.refresh(); })}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
