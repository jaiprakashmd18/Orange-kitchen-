"use server";

import { adminAction, str } from "@/lib/admin-action";
import { HttpError } from "@/lib/auth";
import { getConfig, saveSecrets } from "@/lib/config";
import { configureAuth, requestOrigin, verifyToken } from "@/lib/supabase-management";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin → Integrations. Every key is tested before it is saved, and saved
// encrypted (see lib/config.ts). Keys set as Vercel env vars are read-only here.

const A = { roles: ["admin"] as "admin"[], revalidate: ["/admin"] };
const remove = (f: FormData) => str(f, "remove") === "1";

export const saveRazorpay = adminAction({ ...A, audit: "integration.razorpay" }, async (f, ctx) => {
  if (remove(f)) {
    await saveSecrets({ razorpay_key_id: "", razorpay_key_secret: "", razorpay_webhook_secret: "" }, ctx.userId);
    return { message: "Razorpay disconnected." };
  }
  const id = str(f, "razorpay_key_id");
  const secret = str(f, "razorpay_key_secret") || (await getConfig()).razorpay_key_secret;
  const webhook = str(f, "razorpay_webhook_secret");
  if (!/^rzp_(test|live)_[A-Za-z0-9]{10,}$/.test(id)) throw new HttpError(400, "Key ID should look like rzp_test_XXXXXXXX or rzp_live_XXXXXXXX.");
  if (!secret) throw new HttpError(400, "Enter the Key Secret.");
  const res = await fetch("https://api.razorpay.com/v1/orders?count=1", {
    headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` },
    cache: "no-store",
  }).catch(() => null);
  if (!res) throw new HttpError(502, "Couldn't reach Razorpay. Try again.");
  if (res.status === 401) throw new HttpError(400, "Razorpay rejected these keys. Copy the Key ID and Key Secret again from the Razorpay dashboard.");
  await saveSecrets({ razorpay_key_id: id, razorpay_key_secret: secret, ...(webhook ? { razorpay_webhook_secret: webhook } : {}) }, ctx.userId);
  return { message: `Razorpay connected (${id.startsWith("rzp_live_") ? "LIVE" : "TEST"} mode). Customers can now pay by card, UPI and net banking.` };
});

async function verifySmtp(s: { host: string; port: number; user: string; pass: string }) {
  const nodemailer = (await import("nodemailer")).default;
  const t = nodemailer.createTransport({ host: s.host, port: s.port, secure: s.port === 465, auth: { user: s.user, pass: s.pass }, connectionTimeout: 15_000 });
  try {
    await t.verify();
  } catch (e) {
    const msg = (e as Error).message;
    if (/Application-specific password|535|BadCredentials|Username and Password not accepted/i.test(msg)) {
      throw new HttpError(400, "Gmail rejected the login. Use a 16-letter App Password (myaccount.google.com/apppasswords), not your normal Gmail password.");
    }
    throw new HttpError(400, `Couldn't connect to the mail server: ${msg.slice(0, 150)}`);
  }
}

export const saveEmail = adminAction({ ...A, audit: "integration.email" }, async (f, ctx) => {
  if (remove(f)) {
    await saveSecrets({ smtp_host: "", smtp_port: "", smtp_user: "", smtp_pass: "", smtp_sender_email: "", smtp_sender_name: "" }, ctx.userId);
    return { message: "Email disconnected." };
  }
  const user = str(f, "smtp_user").toLowerCase();
  const pass = str(f, "smtp_pass").replace(/\s/g, "") || (await getConfig()).smtp_pass;
  const host = str(f, "smtp_host") || "smtp.gmail.com";
  const port = Number(str(f, "smtp_port") || 465);
  const senderName = str(f, "smtp_sender_name") || "Orange Kitchen";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user)) throw new HttpError(400, "Enter the email address (e.g. orangekitchen@gmail.com).");
  if (!pass) throw new HttpError(400, "Enter the App Password.");
  if (![465, 587, 25, 2525].includes(port)) throw new HttpError(400, "Port should be 465 or 587.");
  await verifySmtp({ host, port, user, pass });
  await saveSecrets(
    { smtp_host: host, smtp_port: String(port), smtp_user: user, smtp_pass: pass, smtp_sender_email: user, smtp_sender_name: senderName },
    ctx.userId,
  );

  // Also send sign-up / login / reset emails through this account.
  const token = (await getConfig()).supabase_access_token;
  let authNote = " Add your Supabase access token below to also use it for login emails.";
  if (token) {
    try {
      await configureAuth(token, await requestOrigin(), { host, port, user, pass, senderEmail: user, senderName });
      authNote = " Login & sign-up emails now also come from this address.";
    } catch (e) {
      authNote = ` (Couldn't update login emails: ${(e as Error).message})`;
    }
  }
  return { message: `Email connected — order updates will be sent from ${user}.${authNote}` };
});

export const sendTestEmail = adminAction({ ...A, audit: "integration.email_test" }, async (_f, ctx) => {
  const c = await getConfig();
  if (!c.smtp_host || !c.smtp_user || !c.smtp_pass) throw new HttpError(400, "Connect your email first.");
  const { data } = await createAdminClient().auth.admin.getUserById(ctx.userId);
  const to = data.user?.email;
  if (!to) throw new HttpError(400, "Your account has no email address.");
  const nodemailer = (await import("nodemailer")).default;
  const port = Number(c.smtp_port || 465);
  await nodemailer
    .createTransport({ host: c.smtp_host, port, secure: port === 465, auth: { user: c.smtp_user, pass: c.smtp_pass } })
    .sendMail({
      from: { name: c.smtp_sender_name || "Orange Kitchen", address: c.smtp_sender_email || c.smtp_user },
      to,
      subject: "Orange Kitchen — test email ✅",
      text: "Your Orange Kitchen website can send emails. Customers will receive order updates from this address.",
    });
  return { message: `Test email sent to ${to}. Check your inbox (and spam folder).` };
});

export const saveSupabaseToken = adminAction({ ...A, audit: "integration.supabase_token" }, async (f, ctx) => {
  if (remove(f)) {
    await saveSecrets({ supabase_access_token: "" }, ctx.userId);
    return { message: "Supabase access token removed." };
  }
  const token = str(f, "supabase_access_token");
  await verifyToken(token).catch((e) => {
    throw new HttpError(400, (e as Error).message);
  });
  await saveSecrets({ supabase_access_token: token }, ctx.userId);
  const c = await getConfig();
  const smtp = c.smtp_host && c.smtp_user && c.smtp_pass
    ? { host: c.smtp_host, port: Number(c.smtp_port || 465), user: c.smtp_user, pass: c.smtp_pass, senderEmail: c.smtp_sender_email || c.smtp_user, senderName: c.smtp_sender_name || "Orange Kitchen" }
    : null;
  const origin = await requestOrigin();
  try {
    await configureAuth(token, origin, smtp);
  } catch (e) {
    throw new HttpError(400, `Token saved, but the login settings couldn't be applied. ${(e as Error).message}`);
  }
  return { message: `Connected. Login links now point to ${origin}${smtp ? " and login emails come from " + smtp.user : ""}.` };
});

export const saveWhatsApp = adminAction({ ...A, audit: "integration.whatsapp" }, async (f, ctx) => {
  if (remove(f)) {
    await saveSecrets({ whatsapp_access_token: "", whatsapp_phone_number_id: "", whatsapp_order_template: "", whatsapp_template_lang: "" }, ctx.userId);
    return { message: "WhatsApp disconnected." };
  }
  const token = str(f, "whatsapp_access_token") || (await getConfig()).whatsapp_access_token;
  const phoneId = str(f, "whatsapp_phone_number_id");
  const template = str(f, "whatsapp_order_template");
  if (!token || !/^\d{6,20}$/.test(phoneId) || !/^[a-z0-9_]{1,512}$/.test(template)) {
    throw new HttpError(400, "Enter the access token, the numeric Phone number ID and the approved template name (lowercase).");
  }
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).catch(() => null);
  if (!res?.ok) throw new HttpError(400, "Meta rejected the token or Phone number ID. Check them in Meta → WhatsApp → API setup.");
  await saveSecrets({ whatsapp_access_token: token, whatsapp_phone_number_id: phoneId, whatsapp_order_template: template, whatsapp_template_lang: str(f, "whatsapp_template_lang") || "en" }, ctx.userId);
  return { message: "WhatsApp connected. Customers who opt in will get order updates on WhatsApp." };
});

export const savePexels = adminAction({ ...A, audit: "integration.pexels" }, async (f, ctx) => {
  if (remove(f)) {
    await saveSecrets({ pexels_api_key: "" }, ctx.userId);
    return { message: "Pexels removed — photos will come from Wikimedia Commons." };
  }
  const key = str(f, "pexels_api_key");
  const res = await fetch("https://api.pexels.com/v1/search?query=dosa&per_page=1", { headers: { Authorization: key }, cache: "no-store" }).catch(() => null);
  if (!res?.ok) throw new HttpError(400, "Pexels rejected this key. Copy it again from pexels.com/api.");
  await saveSecrets({ pexels_api_key: key }, ctx.userId);
  return { message: "Pexels connected — automatic dish photos will use Pexels." };
});

export const savePixabay = adminAction({ ...A, audit: "integration.pixabay" }, async (f, ctx) => {
  if (remove(f)) {
    await saveSecrets({ pixabay_api_key: "" }, ctx.userId);
    return { message: "Pixabay removed." };
  }
  const key = str(f, "pixabay_api_key");
  if (!/^[A-Za-z0-9-]{10,}$/.test(key)) throw new HttpError(400, "That doesn't look like a Pixabay key. Copy it from pixabay.com/api/docs (shown after you log in).");
  const res = await fetch(`https://pixabay.com/api/?key=${encodeURIComponent(key)}&q=dosa&per_page=3`, { cache: "no-store" }).catch(() => null);
  if (!res?.ok) throw new HttpError(400, "Pixabay rejected this key. Copy it again from pixabay.com/api/docs.");
  await saveSecrets({ pixabay_api_key: key }, ctx.userId);
  return { message: "Pixabay connected — automatic dish photos will also search Pixabay." };
});
