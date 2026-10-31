import type { PaymentMethod, RestaurantSettings } from "@/lib/types";

/** Which online payment methods customers can use right now (server only). */
export async function availablePaymentMethods(settings: Pick<RestaurantSettings, "upi_enabled" | "upi_id">): Promise<PaymentMethod[]> {
  const { getIntegrationStatus } = await import("@/lib/config");
  const methods: PaymentMethod[] = [];
  if (settings.upi_enabled && settings.upi_id) methods.push("upi");
  if ((await getIntegrationStatus()).razorpay) methods.push("razorpay");
  return methods;
}

/** upi://pay deep link understood by GPay, PhonePe, Paytm, BHIM and bank apps. */
export function upiPayLink(args: { upiId: string; payeeName: string; amount: number; orderNumber: string }, scheme = "upi://pay") {
  const q = new URLSearchParams({
    pa: args.upiId,
    pn: args.payeeName.slice(0, 50),
    am: args.amount.toFixed(2),
    cu: "INR",
    tn: `Order ${args.orderNumber}`.slice(0, 50),
    tr: args.orderNumber,
  });
  return `${scheme}?${q.toString().replace(/\+/g, "%20")}`;
}

/** UPI transaction reference (UTR / RRN) — 12 digits in all major UPI apps. */
export const UTR_PATTERN = /^\d{12}$/;
