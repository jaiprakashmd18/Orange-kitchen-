import "server-only";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { headers } from "next/headers";

// Supabase Management API helpers (used by the /setup wizard and the
// Integrations page). Requires a personal access token from
// supabase.com/dashboard/account/tokens.

const API = "https://api.supabase.com/v1";

export function projectRef() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;
}

/** The site's public origin as the browser sees it. */
export async function requestOrigin() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// What each call needs, so a scoped token with missing permissions gets a clear message.
const NEEDS: Record<string, string> = {
  project: "Project → read access",
  sql: "Database → read & write (SQL) access",
  auth: "Application services → Auth → read & write access",
};

async function api(token: string, pathname: string, init: RequestInit = {}, needs?: keyof typeof NEEDS) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(60_000),
  });
  const text = await res.text();
  if (res.status === 401) throw new Error("Supabase says this token is invalid or expired. Create a new token and paste it again.");
  if (res.status === 403 && needs) throw new Error(`This token doesn't have permission for: ${NEEDS[needs]}. Edit the token's permissions (or create a new one) and try again.`);
  if (!res.ok) {
    let msg = text.slice(0, 300);
    try {
      msg = (JSON.parse(text) as { message?: string }).message ?? msg;
    } catch {}
    throw new Error(`Supabase (${res.status}): ${msg}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Confirms the token can manage THIS project (proves the caller owns it). */
export async function verifyToken(token: string) {
  const ref = projectRef();
  if (!ref) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not a supabase.co project URL.");
  const t = token.trim();
  if (t.length < 20 || /\s/.test(t)) throw new Error("That doesn't look like a Supabase access token. Copy the whole token shown after you click Generate.");
  if (t.startsWith("eyJ")) throw new Error("That's a project API key, not an access token. Create one at supabase.com/dashboard/account/tokens.");
  await api(t, `/projects/${ref}`, {}, "project");
  return ref;
}

export async function runSql(token: string, query: string) {
  return api(token, `/projects/${projectRef()}/database/query`, { method: "POST", body: JSON.stringify({ query }) }, "sql") as Promise<Record<string, unknown>[] | null>;
}

const lit = (v: string) => `'${v.replace(/'/g, "''")}'`;

/** Applies supabase/migrations/*.sql in order (tracked, idempotent). */
export async function migrateViaApi(token: string) {
  await runSql(
    token,
    `create schema if not exists ok_internal;
     revoke all on schema ok_internal from public;
     create table if not exists ok_internal.schema_migrations (name text primary key, applied_at timestamptz not null default now());`,
  );
  const dir = path.join(process.cwd(), "supabase/migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const rows = (await runSql(token, "select name from ok_internal.schema_migrations")) ?? [];
  const applied = new Set(rows.map((r) => String(r.name)));
  if (applied.size === 0) {
    const [row] = (await runSql(token, "select to_regclass('public.orders') is not null as exists")) ?? [];
    if (row?.exists === true) {
      for (const f of files.filter((x) => x <= "20261030000400_seed.sql")) {
        await runSql(token, `insert into ok_internal.schema_migrations (name) values (${lit(f)}) on conflict do nothing`);
        applied.add(f);
      }
    }
  }
  const done: string[] = [];
  for (const f of files) {
    if (applied.has(f)) continue;
    const body = await readFile(path.join(dir, f), "utf8");
    await runSql(token, `begin;\n${body}\n;insert into ok_internal.schema_migrations (name) values (${lit(f)});\ncommit;`);
    done.push(f);
  }
  return done;
}

export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  pass: string;
  senderEmail: string;
  senderName: string;
}

/** Site URL, redirect allow-list, email confirmation and (optionally) custom SMTP for Auth emails. */
export async function configureAuth(token: string, siteUrl: string, smtp?: SmtpSettings | null) {
  const allow = [...new Set([`${siteUrl}/**`, "http://localhost:3000/**", process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/**` : null].filter(Boolean))].join(",");
  const body: Record<string, unknown> = { site_url: siteUrl, uri_allow_list: allow, mailer_autoconfirm: false, external_email_enabled: true };
  if (smtp) {
    Object.assign(body, {
      smtp_host: smtp.host,
      smtp_port: String(smtp.port),
      smtp_user: smtp.user,
      smtp_pass: smtp.pass,
      smtp_admin_email: smtp.senderEmail,
      smtp_sender_name: smtp.senderName,
      // Supabase's default limit with custom SMTP is low; allow normal traffic.
      rate_limit_email_sent: 100,
    });
  }
  await api(token, `/projects/${projectRef()}/config/auth`, { method: "PATCH", body: JSON.stringify(body) }, "auth");
  return allow;
}
