import "server-only";
import crypto from "node:crypto";
import { getConfig } from "@/lib/config";

// Thin Razorpay REST client. Secrets stay on the server.
const API = "https://api.razorpay.com/v1";

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const c = await getConfig();
  if (!c.razorpay_key_id || !c.razorpay_key_secret) throw new Error("Razorpay keys are not configured");
  const auth = Buffer.from(`${c.razorpay_key_id}:${c.razorpay_key_secret}`).toString("base64");
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const description = (body as { error?: { description?: string } })?.error?.description ?? res.statusText;
    throw new Error(`Razorpay ${path} failed (${res.status}): ${description}`);
  }
  return body as T;
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
}

export interface RazorpayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  method: string;
  error_description?: string | null;
}

export interface RazorpayRefund {
  id: string;
  payment_id: string;
  amount: number;
  status: "pending" | "processed" | "failed";
}

export function createRazorpayOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
  return call<RazorpayOrder>("/orders", {
    method: "POST",
    body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.receipt.slice(0, 40), notes: input.notes }),
  });
}

export function fetchPayment(paymentId: string) {
  return call<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}`);
}

export async function fetchOrderPayments(orderId: string) {
  const res = await call<{ items: RazorpayPayment[] }>(`/orders/${encodeURIComponent(orderId)}/payments`);
  return res.items ?? [];
}

export function fetchRefund(paymentId: string, refundId: string) {
  return call<RazorpayRefund>(`/payments/${encodeURIComponent(paymentId)}/refunds/${encodeURIComponent(refundId)}`);
}

export function capturePayment(paymentId: string, amountPaise: number) {
  return call<RazorpayPayment>(`/payments/${encodeURIComponent(paymentId)}/capture`, {
    method: "POST",
    body: JSON.stringify({ amount: amountPaise, currency: "INR" }),
  });
}

export function refundPayment(paymentId: string, amountPaise: number, notes: Record<string, string>, idempotencyKey: string) {
  return call<RazorpayRefund>(`/payments/${encodeURIComponent(paymentId)}/refund`, {
    method: "POST",
    headers: { "X-Refund-Idempotency": idempotencyKey },
    body: JSON.stringify({ amount: amountPaise, speed: "normal", notes }),
  });
}

function safeEqualHex(a: string, b: string) {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb);
}

/** Checkout handler signature: HMAC_SHA256(order_id|payment_id, key_secret) */
export async function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  const { razorpay_key_secret } = await getConfig();
  if (!razorpay_key_secret) return false;
  const expected = crypto.createHmac("sha256", razorpay_key_secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeEqualHex(expected, signature);
}

/** Webhook signature: HMAC_SHA256(raw_body, webhook_secret) */
export async function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const { razorpay_webhook_secret } = await getConfig();
  if (!razorpay_webhook_secret) throw new Error("Razorpay webhook secret is not configured");
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = crypto.createHmac("sha256", razorpay_webhook_secret).update(rawBody).digest("hex");
  return safeEqualHex(expected, signature);
}
