#!/usr/bin/env node
// Orange Kitchen one-command setup.
//
//   npm run setup            (local; reads .env.local / .env)
//   node scripts/setup.mjs --build   (runs automatically before `next build` on Vercel)
//
// What it does, using only environment variables:
//   1. Applies supabase/migrations/*.sql in order (tracked, idempotent).
//   2. Creates/promotes the first admin from ADMIN_EMAIL / ADMIN_PASSWORD.
//   3. (optional, SUPABASE_ACCESS_TOKEN) configures Supabase Auth: site URL,
//      redirect allow-list, email confirmation, custom SMTP.
//   4. Verifies Razorpay keys and prints what is / isn't configured.
//
// In --build mode problems are reported in the build log but never fail the
// deployment (the site's /setup page then explains what to fix). Set
// SETUP_STRICT=1 to make database problems fail the build instead.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const f of [".env.local", ".env"]) if (existsSync(path.join(root, f))) dotenv.config({ path: path.join(root, f) });

const BUILD = process.argv.includes("--build");
const STRICT = process.env.SETUP_STRICT === "1";
const env = process.env;
const ok = (m) => console.log(`  ✓ ${m}`);
const warn = (m) => console.log(`  ! ${m}`);
const fail = (m) => console.log(`  ✗ ${m}`);
let hardError = false;

/** Keeps only sslmode from the URL query (pooler URLs carry extra params Postgres rejects). */
function cleanUrl(raw) {
  const u = new URL(raw);
  const keep = u.searchParams.get("sslmode");
  u.search = keep ? `?sslmode=${keep}` : "";
  return u.toString();
}

async function connect(urls) {
  for (const raw of urls) {
    const url = cleanUrl(raw);
    const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
    const sql = postgres(url, { ssl: local ? false : "require", prepare: false, max: 1, onnotice: () => {}, connect_timeout: 15 });
    try {
      await sql`select 1`;
      return sql;
    } catch (e) {
      warn(`database connection failed (${new URL(url).host}): ${e.message}`);
      await sql.end({ timeout: 1 }).catch(() => {});
    }
  }
  return null;
}

function siteUrl() {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

// ── Database access: direct Postgres connection, or the Supabase Management
// API (SQL over HTTPS with SUPABASE_ACCESS_TOKEN) when no DB URL works.
const lit = (v) => `'${String(v).replace(/'/g, "''")}'`;
const projectRef = () => env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];

function pgDb(sql) {
  return {
    kind: "postgres connection",
    q: (text) => sql.unsafe(text),
    tx: (body) => sql.begin((t) => t.unsafe(body)),
    end: () => sql.end({ timeout: 5 }),
  };
}

function apiDb(ref, token) {
  const q = async (text) => {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: text }),
    });
    const body = await res.text();
    if (!res.ok) throw new Error(`Supabase API ${res.status}: ${body.slice(0, 300)}`);
    try {
      const rows = JSON.parse(body);
      return Array.isArray(rows) ? rows : [];
    } catch {
      return [];
    }
  };
  return { kind: "Supabase Management API", q, tx: (b) => q(`begin;\n${b}\ncommit;`), end: async () => {} };
}

async function migrate(db) {
  console.log(`\n▸ Database migrations (via ${db.kind})`);
  await db.q(`
    create schema if not exists ok_internal;
    revoke all on schema ok_internal from public;
    create table if not exists ok_internal.schema_migrations (name text primary key, applied_at timestamptz not null default now());
  `);
  const dir = path.join(root, "supabase/migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set((await db.q(`select name from ok_internal.schema_migrations`)).map((r) => r.name));

  // Database set up by hand earlier (tables exist, nothing tracked): baseline it.
  if (applied.size === 0) {
    const [row] = await db.q(`select to_regclass('public.orders') is not null as exists`);
    if (row?.exists === true || row?.exists === "t") {
      const baseline = files.filter((f) => f <= "20261030000400_seed.sql");
      for (const f of baseline) await db.q(`insert into ok_internal.schema_migrations (name) values (${lit(f)}) on conflict do nothing`);
      baseline.forEach((f) => applied.add(f));
      warn(`existing schema detected — marked ${baseline.length} initial migrations as applied`);
    }
  }

  let n = 0;
  for (const f of files) {
    if (applied.has(f)) continue;
    const body = readFileSync(path.join(dir, f), "utf8");
    await db.tx(`${body}\n;insert into ok_internal.schema_migrations (name) values (${lit(f)});`);
    ok(`applied ${f}`);
    n++;
  }
  if (n === 0) ok("database is up to date");
}

async function bootstrapAdmin(db) {
  console.log("\n▸ Admin account");
  const email = env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) return warn("ADMIN_EMAIL not set — skip (you can grant admin later in Admin → Staff access)");
  const [existing] = await db.q(`select id from auth.users where lower(email) = ${lit(email)}`);
  let userId = existing?.id;
  if (!userId) {
    if (!env.ADMIN_PASSWORD || env.ADMIN_PASSWORD.length < 10) return warn("ADMIN_PASSWORD (min 10 chars) needed to create the admin login");
    if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.NEXT_PUBLIC_SUPABASE_URL) return warn("Supabase URL / service role key missing — cannot create admin");
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data, error } = await supabase.auth.admin.createUser({ email, password: env.ADMIN_PASSWORD, email_confirm: true, user_metadata: { full_name: env.ADMIN_NAME || "Orange Kitchen Admin" } });
    if (error) return fail(`could not create admin: ${error.message}`);
    userId = data.user.id;
    ok(`created admin login ${email}`);
  }
  await db.q(`insert into public.user_roles (user_id, role) values (${lit(userId)}, 'admin') on conflict do nothing`);
  ok(`${email} has admin access → ${siteUrl()}/admin`);
}

async function configureAuth() {
  console.log("\n▸ Supabase Auth settings");
  const token = env.SUPABASE_ACCESS_TOKEN;
  const ref = env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
  if (!token || !ref) return warn("SUPABASE_ACCESS_TOKEN not set — configure Site URL & redirect URLs in the Supabase dashboard (see docs/SETUP.md)");
  const site = siteUrl();
  const allow = [...new Set([`${site}/**`, "http://localhost:3000/**", env.VERCEL_URL ? `https://${env.VERCEL_URL}/**` : null].filter(Boolean))].join(",");
  const body = { site_url: site, uri_allow_list: allow, mailer_autoconfirm: false, external_email_enabled: true };
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    Object.assign(body, {
      smtp_host: env.SMTP_HOST,
      smtp_port: String(env.SMTP_PORT || "587"),
      smtp_user: env.SMTP_USER,
      smtp_pass: env.SMTP_PASS,
      smtp_admin_email: env.SMTP_SENDER_EMAIL || env.SMTP_USER,
      smtp_sender_name: env.SMTP_SENDER_NAME || "Orange Kitchen",
    });
  }
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return fail(`Auth config update failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  ok(`site URL ${site}; redirects allowed for ${allow}`);
  if (env.SMTP_HOST) ok(`custom SMTP ${env.SMTP_HOST}`);
}

async function checkRazorpay() {
  console.log("\n▸ Razorpay");
  const id = env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const secret = env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) return warn("Razorpay keys not set — checkout stays disabled until NEXT_PUBLIC_RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are added");
  try {
    const res = await fetch("https://api.razorpay.com/v1/orders?count=1", { headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` } });
    if (res.ok) ok(`keys valid (${id.startsWith("rzp_live_") ? "LIVE" : "TEST"} mode)`);
    else fail(`keys rejected by Razorpay (${res.status}) — check NEXT_PUBLIC_RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET`);
  } catch (e) {
    warn(`could not reach Razorpay: ${e.message}`);
  }
  if (env.RAZORPAY_WEBHOOK_SECRET) ok(`webhook secret set — webhook URL: ${siteUrl()}/api/webhooks/razorpay`);
  else warn("RAZORPAY_WEBHOOK_SECRET not set — payments are still confirmed by signature check + automatic reconciliation; adding the webhook makes it instant in every edge case");
}

function summary() {
  console.log("\n▸ Optional integrations");
  const mail = env.RESEND_API_KEY && env.EMAIL_FROM ? "Resend" : env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS ? `SMTP (${env.SMTP_HOST})` : null;
  (mail ? ok : warn)(`order email notifications ${mail ? `on via ${mail}` : "off (set SMTP_* e.g. Gmail, or RESEND_API_KEY + EMAIL_FROM)"}`);
  const wa = env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_ORDER_TEMPLATE;
  (wa ? ok : warn)(`WhatsApp notifications ${wa ? "on" : "off (set WHATSAPP_* variables)"}`);
}

(async () => {
  console.log(`Orange Kitchen setup${BUILD ? " (build)" : ""}`);
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((k) => !env[k]);
  if (missing.length) {
    (BUILD ? warn : fail)(`missing ${missing.join(", ")}`);
    if (!BUILD) hardError = true;
  }

  // 1) SUPABASE_DB_URL or the Supabase ↔ Vercel integration's POSTGRES_URL*;
  // 2) otherwise the Supabase Management API with SUPABASE_ACCESS_TOKEN.
  const candidates = [env.SUPABASE_DB_URL, env.POSTGRES_URL_NON_POOLING, env.POSTGRES_URL].filter(Boolean);
  const sql = candidates.length ? await connect(candidates) : null;
  let db = sql ? pgDb(sql) : null;
  if (!db && env.SUPABASE_ACCESS_TOKEN && projectRef()) {
    db = apiDb(projectRef(), env.SUPABASE_ACCESS_TOKEN);
    if (candidates.length) warn("falling back to the Supabase Management API for database setup");
  }
  if (!db) {
    (BUILD ? warn : fail)("database not set up — add SUPABASE_ACCESS_TOKEN (simplest) or SUPABASE_DB_URL (Session pooler connection string)");
    if (!BUILD || STRICT) hardError = true;
  } else {
    try {
      await migrate(db);
      try {
        await bootstrapAdmin(db);
      } catch (e) {
        fail(`admin bootstrap: ${e.message}`);
      }
    } catch (e) {
      fail(`migration failed: ${e.message}`);
      if (!BUILD || STRICT) hardError = true;
    } finally {
      await db.end();
    }
  }

  try { await configureAuth(); } catch (e) { warn(`auth config: ${e.message}`); }
  await checkRazorpay();
  summary();
  console.log(hardError ? "\nSetup finished with errors.\n" : `\nDone. Open ${siteUrl()}/admin to finish restaurant details.\n`);
  process.exit(hardError ? 1 : 0);
})().catch((e) => {
  // Never let an unexpected setup error block a deployment.
  console.error("setup crashed:", e);
  process.exit(BUILD && !STRICT ? 0 : 1);
});
