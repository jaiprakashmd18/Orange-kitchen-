import type { Fulfillment, OrderStatus } from "./types";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending_payment: "Awaiting payment",
  payment_failed: "Payment failed",
  expired: "Payment not completed",
  payment_confirmed: "Payment confirmed",
  accepted: "Order accepted",
  preparing: "Food preparing",
  ready: "Ready for pickup",
  delivery_assigned: "Delivery assigned",
  picked_up: "Picked up",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  collected: "Picked up by customer",
  rejected: "Declined by restaurant",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<OrderStatus, "neutral" | "warning" | "success" | "danger" | "info"> = {
  pending_payment: "warning",
  payment_failed: "danger",
  expired: "neutral",
  payment_confirmed: "info",
  accepted: "info",
  preparing: "info",
  ready: "info",
  delivery_assigned: "info",
  picked_up: "info",
  out_for_delivery: "info",
  delivered: "success",
  collected: "success",
  rejected: "danger",
  cancelled: "danger",
};

/** Customer-facing progress stages (spec §9). "Order Placed" is the creation step. */
export const DELIVERY_STAGES: { key: OrderStatus | "placed"; label: string }[] = [
  { key: "placed", label: "Order Placed" },
  { key: "payment_confirmed", label: "Payment Confirmed" },
  { key: "accepted", label: "Order Accepted" },
  { key: "preparing", label: "Food Preparing" },
  { key: "ready", label: "Ready for Pickup" },
  { key: "delivery_assigned", label: "Delivery Assigned" },
  { key: "picked_up", label: "Picked Up" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

export const TAKEAWAY_STAGES: { key: OrderStatus | "placed"; label: string }[] = [
  { key: "placed", label: "Order Placed" },
  { key: "payment_confirmed", label: "Payment Confirmed" },
  { key: "accepted", label: "Order Accepted" },
  { key: "preparing", label: "Food Preparing" },
  { key: "ready", label: "Ready for Pickup" },
  { key: "collected", label: "Picked Up by Customer" },
];

export const stagesFor = (f: Fulfillment) => (f === "delivery" ? DELIVERY_STAGES : TAKEAWAY_STAGES);

/** Index of the current stage; -1 for terminal non-progress states. */
export function stageIndex(f: Fulfillment, status: OrderStatus) {
  if (status === "pending_payment" || status === "payment_failed") return 0;
  return stagesFor(f).findIndex((s) => s.key === status);
}

export const ACTIVE_STATUSES: OrderStatus[] = [
  "payment_confirmed",
  "accepted",
  "preparing",
  "ready",
  "delivery_assigned",
  "picked_up",
  "out_for_delivery",
];

export const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "collected", "rejected", "cancelled", "expired"];

/** Next actions the kitchen/admin can take from a status. */
export function staffNextActions(f: Fulfillment, status: OrderStatus): { to: OrderStatus; label: string; tone: "primary" | "danger" }[] {
  switch (status) {
    case "payment_confirmed":
      return [
        { to: "accepted", label: "Accept order", tone: "primary" },
        { to: "rejected", label: "Reject & refund", tone: "danger" },
      ];
    case "accepted":
      return [
        { to: "preparing", label: "Start preparing", tone: "primary" },
        { to: "cancelled", label: "Cancel & refund", tone: "danger" },
      ];
    case "preparing":
      return [
        { to: "ready", label: f === "takeaway" ? "Ready for pickup" : "Food ready", tone: "primary" },
        { to: "cancelled", label: "Cancel & refund", tone: "danger" },
      ];
    case "ready":
      return f === "takeaway"
        ? [
            { to: "collected", label: "Collected by customer", tone: "primary" },
            { to: "cancelled", label: "Cancel & refund", tone: "danger" },
          ]
        : [{ to: "cancelled", label: "Cancel & refund", tone: "danger" }];
    case "delivery_assigned":
      return [{ to: "picked_up", label: "Mark picked up", tone: "primary" }];
    case "picked_up":
      return [{ to: "out_for_delivery", label: "Out for delivery", tone: "primary" }];
    case "out_for_delivery":
      return [{ to: "delivered", label: "Mark delivered", tone: "primary" }];
    default:
      return [];
  }
}
