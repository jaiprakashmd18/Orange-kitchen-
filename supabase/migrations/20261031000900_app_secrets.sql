-- =====================================================================
-- Integration keys entered in Admin → Integrations (Razorpay, Gmail SMTP,
-- WhatsApp, Pexels, Supabase access token). Values are AES-256-GCM
-- encrypted by the app server before they reach the database, and the
-- table is reachable only with the service role (RLS on, no policies,
-- no grants to anon/authenticated). Environment variables, when set,
-- always take precedence over these values.
-- =====================================================================
create table if not exists public.app_secrets (
  key text primary key check (key ~ '^[a-z0-9_]{2,64}$'),
  value_encrypted text not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
alter table public.app_secrets force row level security;
revoke all on public.app_secrets from anon, authenticated;
