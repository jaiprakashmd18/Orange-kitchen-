-- =====================================================================
-- Direct UPI payments (GPay / PhonePe / Paytm / any UPI app) to the
-- restaurant's own UPI ID, alongside (or instead of) Razorpay.
--
-- Money goes straight to the restaurant's UPI ID, so there is no gateway
-- to confirm it automatically. Flow:
--   customer pays via UPI link/QR → submits the 12-digit UTR →
--   payment = 'verification_pending' → staff check their UPI app →
--   "Payment received" confirms the order (or "Not received" fails it).
-- A UTR can only ever be used once (unique provider_payment_id).
-- =====================================================================

alter type public.payment_status add value if not exists 'verification_pending';

alter table public.restaurant_settings
  add column if not exists upi_enabled boolean not null default false,
  add column if not exists upi_id text,
  add column if not exists upi_payee_name text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'restaurant_settings_upi_id_format') then
    alter table public.restaurant_settings
      add constraint restaurant_settings_upi_id_format check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,128}@[A-Za-z0-9]{2,64}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'restaurant_settings_upi_requires_id') then
    alter table public.restaurant_settings
      add constraint restaurant_settings_upi_requires_id check (not upi_enabled or upi_id is not null);
  end if;
end $$;

alter table public.payments add column if not exists submitted_at timestamptz;
alter table public.payments drop constraint if exists payments_verified_via_check;
alter table public.payments add constraint payments_verified_via_check
  check (verified_via in ('signature', 'webhook', 'manual'));

-- Failure handling now also covers a UPI payment awaiting verification.
create or replace function public.record_payment_failure(
  p_provider_order_id text,
  p_provider_payment_id text,
  p_reason text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_status public.order_status;
begin
  select * into v_payment from public.payments where provider_order_id = p_provider_order_id for update;
  if not found then
    return null;
  end if;
  if v_payment.status::text not in ('created', 'failed', 'authorized', 'verification_pending') then
    return v_payment.order_id; -- never downgrade a captured payment
  end if;

  update public.payments set
    status = 'failed',
    provider_payment_id = coalesce(p_provider_payment_id, provider_payment_id),
    failure_reason = left(p_reason, 300),
    attempts = attempts + 1
  where id = v_payment.id;

  select status into v_status from public.orders where id = v_payment.order_id;
  if v_status = 'pending_payment' then
    perform public.transition_order_status(v_payment.order_id, 'payment_failed', null, 'system', left(p_reason, 300));
  end if;
  return v_payment.order_id;
end $$;

-- Orders whose UPI payment is waiting for staff verification never expire.
create or replace function public.expire_unpaid_orders()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select o.id from public.orders o
     where o.status in ('pending_payment', 'payment_failed') and o.payment_due_at < now()
       and not exists (select 1 from public.payments p where p.order_id = o.id and p.status::text = 'verification_pending')
     for update skip locked
  loop
    perform public.transition_order_status(r.id, 'expired', null, 'system', 'Payment window elapsed');
    n := n + 1;
  end loop;
  return n;
end $$;

revoke execute on function public.record_payment_failure(text, text, text) from public, anon, authenticated;
revoke execute on function public.expire_unpaid_orders() from public, anon, authenticated;
grant execute on function public.record_payment_failure(text, text, text) to service_role;
grant execute on function public.expire_unpaid_orders() to service_role;

-- Staff dashboards refresh live when a customer submits a UPI transaction ID.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'payments') then
    alter publication supabase_realtime add table public.payments;
  end if;
end $$;
