import "server-only";
import crypto from "node:crypto";
import type { DeliveryProvider, Order } from "@/lib/types";

// Third-party delivery integration framework.
//
// Each provider row in `delivery_providers` names an adapter. Credentials are
// never stored in the database: they are read from environment variables
// named after the provider's `env_prefix`, e.g. PORTER_API_KEY and
// PORTER_WEBHOOK_SECRET. A provider whose credentials are missing is reported
// as "not configured" and only manual tracking is offered.
//
// Adapters:
//  - manual        Staff book the partner outside the system and record the
//                  reference / tracking link / rider details by hand.
//  - http_generic  A documented JSON contract (docs/DELIVERY_PROVIDERS.md).
//                  Point it at the provider's API (or a small bridge service)
//                  that speaks this contract. To support a provider's native
//                  API directly, add a new adapter implementing DeliveryAdapter.

export type ProviderEventStatus = "assigned" | "picked_up" | "out_for_delivery" | "delivered" | "cancelled" | "failed";

export interface ProviderEvent {
  eventId: string;
  reference: string;
  status: ProviderEventStatus;
  riderName?: string;
  riderPhone?: string;
  trackingUrl?: string;
}

export interface CreatedDelivery {
  reference: string;
  trackingUrl: string | null;
  fee: number | null;
  riderName?: string | null;
  riderPhone?: string | null;
}

export interface DeliveryAdapter {
  supportsApi: boolean;
  requiredEnv(provider: DeliveryProvider): string[];
  quote?(provider: DeliveryProvider, order: Order): Promise<number | null>;
  create?(provider: DeliveryProvider, order: Order, pickup: PickupInfo): Promise<CreatedDelivery>;
  parseWebhook?(provider: DeliveryProvider, rawBody: string, headers: Headers): ProviderEvent[] | null;
}

export interface PickupInfo {
  name: string;
  phone: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

const env = (provider: DeliveryProvider, key: string) =>
  provider.env_prefix ? process.env[`${provider.env_prefix}_${key}`] ?? "" : "";

const manual: DeliveryAdapter = {
  supportsApi: false,
  requiredEnv: () => [],
};

const httpGeneric: DeliveryAdapter = {
  supportsApi: true,
  requiredEnv: (p) => (p.env_prefix ? [`${p.env_prefix}_API_KEY`, `${p.env_prefix}_WEBHOOK_SECRET`] : ["<env_prefix>_API_KEY"]),

  async quote(provider, order) {
    const res = await fetch(`${provider.api_base_url}/quotes`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env(provider, "API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ drop_pincode: order.delivery_address?.pincode, order_value: Number(order.total_amount) }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Quote failed (${res.status})`);
    const body = (await res.json()) as { fee?: number };
    return typeof body.fee === "number" ? body.fee : null;
  },

  async create(provider, order, pickup) {
    const a = order.delivery_address!;
    const res = await fetch(`${provider.api_base_url}/deliveries`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env(provider, "API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ok-${order.id}`,
      },
      body: JSON.stringify({
        client_reference: order.order_number,
        pickup,
        drop: {
          name: a.full_name,
          phone: a.phone,
          address: [a.house, a.street, a.area, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(", "),
          pincode: a.pincode,
          instructions: a.delivery_instructions,
        },
        order_value: Number(order.total_amount),
        prepaid: true,
      }),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Provider rejected the booking (${res.status})`);
    const body = (await res.json()) as { reference?: string; tracking_url?: string; fee?: number; rider_name?: string; rider_phone?: string };
    if (!body.reference) throw new Error("Provider response missing reference");
    return {
      reference: body.reference,
      trackingUrl: body.tracking_url ?? null,
      fee: typeof body.fee === "number" ? body.fee : null,
      riderName: body.rider_name ?? null,
      riderPhone: body.rider_phone ?? null,
    };
  },

  parseWebhook(provider, rawBody, headers) {
    const secret = env(provider, "WEBHOOK_SECRET");
    const sig = headers.get("x-signature") ?? "";
    if (!secret || !/^[a-f0-9]{64}$/.test(sig)) return null;
    const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"))) return null;
    const body = JSON.parse(rawBody) as {
      event_id: string;
      reference: string;
      status: ProviderEventStatus;
      rider_name?: string;
      rider_phone?: string;
      tracking_url?: string;
    };
    const allowed: ProviderEventStatus[] = ["assigned", "picked_up", "out_for_delivery", "delivered", "cancelled", "failed"];
    if (!body.event_id || !body.reference || !allowed.includes(body.status)) return [];
    return [
      {
        eventId: String(body.event_id),
        reference: String(body.reference),
        status: body.status,
        riderName: body.rider_name,
        riderPhone: body.rider_phone,
        trackingUrl: body.tracking_url,
      },
    ];
  },
};

const ADAPTERS: Record<DeliveryProvider["adapter"], DeliveryAdapter> = { manual, http_generic: httpGeneric };

export function adapterFor(provider: DeliveryProvider) {
  return ADAPTERS[provider.adapter] ?? manual;
}

/** Whether the provider's API integration is usable right now. */
export function providerStatus(provider: DeliveryProvider) {
  const adapter = adapterFor(provider);
  if (!adapter.supportsApi) return { apiActive: false, missing: [] as string[], reason: "Manual tracking only" };
  const missing = adapter.requiredEnv(provider).filter((k) => !process.env[k]);
  if (!provider.api_base_url) missing.push("api_base_url");
  return {
    apiActive: missing.length === 0 && provider.is_active,
    missing,
    reason: missing.length ? `Not activated — missing ${missing.join(", ")}` : provider.is_active ? "API active" : "Provider disabled",
  };
}

export function trackingUrlFor(provider: DeliveryProvider, reference: string) {
  return provider.tracking_url_template ? provider.tracking_url_template.replace("{ref}", encodeURIComponent(reference)) : null;
}
