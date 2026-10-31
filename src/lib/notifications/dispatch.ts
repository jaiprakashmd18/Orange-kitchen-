import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv, serverEnv } from "@/lib/env";
import { formatINR } from "@/lib/format";
import { STATUS_LABEL } from "@/lib/order-status";
import type { Order, OrderStatus } from "@/lib/types";

// Email (Resend) and WhatsApp (Meta WhatsApp Cloud API) delivery.
// In-app notifications are written by a DB trigger on every status change.
// Every attempt — sent, failed or skipped (not configured / not opted in) —
// is recorded in `notifications` so the history is truthful.

const NOTIFY_ON: OrderStatus[] = [
  "payment_confirmed",
  "payment_failed",
  "accepted",
  "preparing",
  "ready",
  "delivery_assigned",
  "out_for_delivery",
  "delivered",
  "collected",
  "rejected",
  "cancelled",
];

const db = () => createAdminClient();

async function record(row: {
  user_id: string;
  order_id: string;
  channel: "email" | "whatsapp";
  event_type: string;
  title: string;
  body: string;
  status: "sent" | "failed" | "skipped";
  provider_message_id?: string | null;
  error?: string | null;
}) {
  const { error } = await db()
    .from("notifications")
    .insert({ ...row, sent_at: row.status === "sent" ? new Date().toISOString() : null });
  if (error) console.error("[notifications] record failed", error.message);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

async function sendEmail(to: string, subject: string, text: string, order: Order) {
  const url = `${publicEnv.siteUrl}/orders/${order.id}`;
  const html = `<!doctype html><html><body style="margin:0;background:#FFFAEE;font-family:Arial,sans-serif;color:#2C1408">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
  <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;padding:32px">
  <tr><td><img src="${publicEnv.siteUrl}/brand/logo-256.png" width="72" height="72" alt="Orange Kitchen" style="display:block;border:0"></td></tr>
  <tr><td style="padding-top:16px;font-size:18px;font-weight:bold">${escapeHtml(subject)}</td></tr>
  <tr><td style="padding-top:8px;font-size:15px;line-height:1.6">${escapeHtml(text)}</td></tr>
  <tr><td style="padding-top:16px;font-size:14px;color:#555">Order ${escapeHtml(order.order_number)} · Total ${escapeHtml(formatINR(order.total_amount))}</td></tr>
  <tr><td style="padding-top:24px"><a href="${url}" style="background:#CC4A0A;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Track your order</a></td></tr>
  </table></td></tr></table></body></html>`;
  const fullSubject = `${subject} · ${order.order_number}`;
  const plain = `${text}\n\nTrack: ${url}`;

  if (!serverEnv.resendApiKey && serverEnv.smtpHost) {
    // SMTP (e.g. Gmail with an App Password) — same account as login emails.
    const nodemailer = (await import("nodemailer")).default;
    const transport = nodemailer.createTransport({
      host: serverEnv.smtpHost,
      port: serverEnv.smtpPort,
      secure: serverEnv.smtpPort === 465,
      auth: { user: serverEnv.smtpUser, pass: serverEnv.smtpPass },
    });
    const info = await transport.sendMail({
      from: { name: serverEnv.smtpSenderName, address: serverEnv.smtpSenderEmail },
      to,
      subject: fullSubject,
      text: plain,
      html,
    });
    return info.messageId ?? null;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${serverEnv.resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: serverEnv.emailFrom, to: [to], subject: fullSubject, text: plain, html }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok) throw new Error(body.message ?? `Resend error ${res.status}`);
  return body.id ?? null;
}

/**
 * Sends an approved WhatsApp template. The template must be approved in
 * Meta Business Manager with 3 body parameters: {{1}} order number,
 * {{2}} status label, {{3}} tracking URL.
 */
async function sendWhatsApp(phone: string, order: Order, statusLabel: string) {
  const digits = phone.replace(/\D/g, "");
  const to = digits.length === 10 ? `91${digits}` : digits;
  const res = await fetch(`https://graph.facebook.com/v21.0/${serverEnv.whatsappPhoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${serverEnv.whatsappToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: serverEnv.whatsappTemplateName,
        language: { code: serverEnv.whatsappTemplateLang },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: order.order_number },
              { type: "text", text: statusLabel },
              { type: "text", text: `${publicEnv.siteUrl}/orders/${order.id}` },
            ],
          },
        ],
      },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok) throw new Error(body.error?.message ?? `WhatsApp error ${res.status}`);
  return body.messages?.[0]?.id ?? null;
}

export async function dispatchOrderNotifications(orderId: string, status: OrderStatus) {
  if (!NOTIFY_ON.includes(status)) return;
  try {
    const { data: order } = await db().from("orders").select("*").eq("id", orderId).single();
    if (!order) return;
    const o = order as Order;
    const [{ data: profile }, { data: inApp }] = await Promise.all([
      db().from("profiles").select("whatsapp_opt_in").eq("id", o.customer_id).single(),
      db()
        .from("notifications")
        .select("title, body")
        .eq("order_id", o.id)
        .eq("channel", "in_app")
        .eq("event_type", `order.${status}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const title = inApp?.title ?? STATUS_LABEL[status];
    const body = inApp?.body ?? `Order ${o.order_number}: ${STATUS_LABEL[status]}`;
    const base = { user_id: o.customer_id, order_id: o.id, event_type: `order.${status}`, title, body };

    // Email
    const emailReady = Boolean((serverEnv.resendApiKey && serverEnv.emailFrom) || (serverEnv.smtpHost && serverEnv.smtpUser && serverEnv.smtpPass));
    if (!emailReady) {
      await record({ ...base, channel: "email", status: "skipped", error: "Email provider not configured" });
    } else if (!o.customer_email) {
      await record({ ...base, channel: "email", status: "skipped", error: "No email on order" });
    } else {
      try {
        const id = await sendEmail(o.customer_email, title, body, o);
        await record({ ...base, channel: "email", status: "sent", provider_message_id: id });
      } catch (e) {
        await record({ ...base, channel: "email", status: "failed", error: (e as Error).message.slice(0, 300) });
      }
    }

    // WhatsApp (only with explicit opt-in)
    if (!serverEnv.whatsappToken || !serverEnv.whatsappPhoneNumberId || !serverEnv.whatsappTemplateName) {
      await record({ ...base, channel: "whatsapp", status: "skipped", error: "WhatsApp API not configured" });
    } else if (!profile?.whatsapp_opt_in) {
      await record({ ...base, channel: "whatsapp", status: "skipped", error: "Customer has not opted in" });
    } else {
      try {
        const id = await sendWhatsApp(o.customer_phone, o, STATUS_LABEL[status]);
        await record({ ...base, channel: "whatsapp", status: "sent", provider_message_id: id });
      } catch (e) {
        await record({ ...base, channel: "whatsapp", status: "failed", error: (e as Error).message.slice(0, 300) });
      }
    }
  } catch (e) {
    console.error("[notifications] dispatch failed", e);
  }
}
