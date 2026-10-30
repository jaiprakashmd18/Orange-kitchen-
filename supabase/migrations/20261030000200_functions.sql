-- =====================================================================
-- Orange Kitchen — functions & triggers
-- Order state machine, payment confirmation, notifications, reports.
-- Functions that mutate orders/payments are executable ONLY by the
-- service role (used by Next.js server routes after authz checks).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Role helpers (security definer so they work inside RLS policies)
-- ---------------------------------------------------------------------
create or replace function public.has_role(p_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role = p_role);
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = auth.uid() and role in ('admin', 'staff'));
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin');
$$;

-- delivery personnel id of the current user (null if not a rider)
create or replace function public.current_rider_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.delivery_personnel where user_id = auth.uid() and is_active;
$$;

-- Definer helpers used by RLS to avoid policy recursion between
-- orders <-> delivery_assignments
create or replace function public.is_assigned_rider(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.delivery_assignments da
      join public.delivery_personnel dp on dp.id = da.personnel_id
     where da.order_id = p_order_id and da.is_current and dp.user_id = auth.uid() and dp.is_active
  );
$$;

create or replace function public.is_order_customer(p_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.orders where id = p_order_id and customer_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- New auth user -> profile row
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(nullif(new.phone, ''), nullif(new.raw_user_meta_data ->> 'phone', ''))
  )
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Keep profile email in sync when a user changes / verifies email
create or replace function public.handle_user_email_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is distinct from old.email then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function public.handle_user_email_change();

-- ---------------------------------------------------------------------
-- Order number: OK-YYMMDD-#### (IST date)
-- ---------------------------------------------------------------------
create or replace function public.assign_order_number()
returns trigger language plpgsql as $$
begin
  if new.order_number is null or new.order_number = '' then
    new.order_number := 'OK' || to_char(now() at time zone 'Asia/Kolkata', 'YYMMDD') || '-' || nextval('public.order_number_seq');
  end if;
  return new;
end $$;

create trigger orders_assign_number
  before insert on public.orders
  for each row execute function public.assign_order_number();

-- Only one default address per user: unset the others first
create or replace function public.ensure_single_default_address()
returns trigger language plpgsql as $$
begin
  if new.is_default then
    update public.customer_addresses set is_default = false
     where user_id = new.user_id and id <> new.id and is_default;
  end if;
  return new;
end $$;

create trigger customer_addresses_single_default
  before insert or update of is_default on public.customer_addresses
  for each row execute function public.ensure_single_default_address();

-- ---------------------------------------------------------------------
-- Order state machine
-- ---------------------------------------------------------------------
create or replace function public.order_transition_allowed(
  p_fulfillment public.fulfillment_type,
  p_from public.order_status,
  p_to public.order_status
) returns boolean language sql immutable as $$
  select case
    when p_from = 'pending_payment'   then p_to in ('payment_confirmed', 'payment_failed', 'expired')
    when p_from = 'payment_failed'    then p_to in ('payment_confirmed', 'expired', 'pending_payment')
    when p_from = 'expired'           then p_to in ('payment_confirmed')  -- late successful payment
    when p_from = 'payment_confirmed' then p_to in ('accepted', 'rejected', 'cancelled')
    when p_from = 'accepted'          then p_to in ('preparing', 'cancelled')
    when p_from = 'preparing'         then p_to in ('ready', 'cancelled')
    when p_from = 'ready' then
      (p_fulfillment = 'delivery' and p_to in ('delivery_assigned', 'cancelled')) or
      (p_fulfillment = 'takeaway' and p_to in ('collected', 'cancelled'))
    when p_from = 'delivery_assigned' then p_fulfillment = 'delivery' and p_to in ('picked_up', 'ready', 'cancelled')
    when p_from = 'picked_up'         then p_fulfillment = 'delivery' and p_to in ('out_for_delivery', 'delivered')
    when p_from = 'out_for_delivery'  then p_fulfillment = 'delivery' and p_to in ('delivered')
    else false
  end;
$$;

-- Transition an order. Raises on an illegal transition.
-- Returns the new status (may be auto-advanced, e.g. ready -> delivery_assigned).
create or replace function public.transition_order_status(
  p_order_id uuid,
  p_to public.order_status,
  p_actor_id uuid default null,
  p_actor_role text default 'system',
  p_note text default null
) returns public.order_status
language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_has_assignment boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_order.status = p_to then
    return v_order.status; -- idempotent
  end if;

  if not public.order_transition_allowed(v_order.fulfillment, v_order.status, p_to) then
    raise exception 'ILLEGAL_TRANSITION %->%', v_order.status, p_to using errcode = 'P0001';
  end if;

  update public.orders set
    status = p_to,
    paid_at = case when p_to = 'payment_confirmed' then coalesce(paid_at, now()) else paid_at end,
    accepted_at = case when p_to = 'accepted' then now() else accepted_at end,
    estimated_ready_at = case
      when p_to = 'accepted' and fulfillment = 'delivery'
        then now() + make_interval(mins => coalesce((select prep_time_minutes from public.restaurant_settings where id = 1), 30))
      else estimated_ready_at end,
    completed_at = case when p_to in ('delivered', 'collected') then now() else completed_at end,
    cancelled_at = case when p_to in ('cancelled', 'rejected') then now() else cancelled_at end,
    cancellation_reason = case when p_to in ('cancelled', 'rejected') then coalesce(p_note, cancellation_reason) else cancellation_reason end
  where id = p_order_id;

  insert into public.order_status_history (order_id, from_status, to_status, actor_id, actor_role, note)
  values (p_order_id, v_order.status, p_to, p_actor_id, p_actor_role, p_note);

  -- Close the delivery assignment on terminal states
  if p_to in ('cancelled', 'rejected') then
    update public.delivery_assignments set status = 'cancelled', is_current = false
     where order_id = p_order_id and is_current;
  elsif p_to = 'delivered' then
    update public.delivery_assignments set status = 'delivered', delivered_at = now()
     where order_id = p_order_id and is_current;
  elsif p_to = 'picked_up' then
    update public.delivery_assignments set status = 'picked_up', picked_up_at = now()
     where order_id = p_order_id and is_current;
  elsif p_to = 'out_for_delivery' then
    update public.delivery_assignments set status = 'out_for_delivery'
     where order_id = p_order_id and is_current;
  end if;

  -- A delivery order marked ready that already has a rider/provider assigned
  -- moves straight on to "delivery_assigned".
  if p_to = 'ready' and v_order.fulfillment = 'delivery' then
    select exists (select 1 from public.delivery_assignments where order_id = p_order_id and is_current)
      into v_has_assignment;
    if v_has_assignment then
      return public.transition_order_status(p_order_id, 'delivery_assigned', null, 'system', 'Delivery partner already assigned');
    end if;
  end if;

  return p_to;
end $$;

-- ---------------------------------------------------------------------
-- Payment confirmation (idempotent; called after signature or webhook
-- verification and an authoritative fetch from Razorpay)
-- ---------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_provider_order_id text,
  p_provider_payment_id text,
  p_amount numeric,
  p_method text,
  p_via text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  select * into v_payment from public.payments where provider_order_id = p_provider_order_id for update;
  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_amount is distinct from v_payment.amount then
    raise exception 'AMOUNT_MISMATCH expected % got %', v_payment.amount, p_amount using errcode = 'P0001';
  end if;

  if v_payment.status in ('captured', 'refund_pending', 'refunded', 'partially_refunded') then
    return v_payment.order_id; -- already processed
  end if;

  update public.payments set
    status = 'captured',
    provider_payment_id = p_provider_payment_id,
    method = coalesce(p_method, method),
    verified_via = p_via,
    captured_at = now(),
    failure_reason = null
  where id = v_payment.id;

  select * into v_order from public.orders where id = v_payment.order_id for update;

  if v_order.status in ('pending_payment', 'payment_failed', 'expired') then
    perform public.transition_order_status(v_order.id, 'payment_confirmed', null, 'system', 'Payment verified via ' || p_via);

    if v_order.coupon_id is not null then
      insert into public.coupon_redemptions (coupon_id, user_id, order_id, discount_amount)
      values (v_order.coupon_id, v_order.customer_id, v_order.id, v_order.discount_amount)
      on conflict (order_id) do nothing;
    end if;

    -- Paid order: clear the customer's server cart
    delete from public.cart_items where cart_id in (select id from public.carts where user_id = v_order.customer_id);
    update public.carts set coupon_code = null, special_instructions = null where user_id = v_order.customer_id;
  end if;

  insert into public.audit_logs (action, entity, entity_id, details)
  values ('payment.confirmed', 'order', v_order.id::text,
          jsonb_build_object('payment_id', p_provider_payment_id, 'via', p_via, 'amount', p_amount));

  return v_order.id;
end $$;

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
  if v_payment.status <> 'created' and v_payment.status <> 'failed' and v_payment.status <> 'authorized' then
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

-- Expire orders that were never paid
create or replace function public.expire_unpaid_orders()
returns int language plpgsql security definer set search_path = public as $$
declare
  r record;
  n int := 0;
begin
  for r in
    select id from public.orders
     where status in ('pending_payment', 'payment_failed') and payment_due_at < now()
     for update skip locked
  loop
    perform public.transition_order_status(r.id, 'expired', null, 'system', 'Payment window elapsed');
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- In-app notification on every customer-visible status change
-- (email / WhatsApp are dispatched by the app server and logged in the
-- same table)
-- ---------------------------------------------------------------------
create or replace function public.notify_order_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_order public.orders%rowtype;
  v_title text;
  v_body text;
begin
  select * into v_order from public.orders where id = new.order_id;

  select t.title, t.body into v_title, v_body from (values
    ('payment_confirmed'::public.order_status, 'Payment confirmed', 'We have received your payment for order ' || v_order.order_number || '. The restaurant will confirm it shortly.'),
    ('payment_failed',     'Payment failed',     'Payment for order ' || v_order.order_number || ' did not go through. You can retry from your order page.'),
    ('accepted',           'Order accepted',     'Orange Kitchen has accepted order ' || v_order.order_number || '.'),
    ('preparing',          'Preparing your food','Your order ' || v_order.order_number || ' is being freshly prepared.'),
    ('ready',              'Food is ready',      case when v_order.fulfillment = 'takeaway'
                                                    then 'Order ' || v_order.order_number || ' is ready for pickup at Orange Kitchen.'
                                                    else 'Order ' || v_order.order_number || ' is packed and waiting for the delivery partner.' end),
    ('delivery_assigned',  'Delivery partner assigned', 'A delivery partner has been assigned to order ' || v_order.order_number || '.'),
    ('picked_up',          'Order picked up',    'Your delivery partner has picked up order ' || v_order.order_number || '.'),
    ('out_for_delivery',   'Out for delivery',   'Order ' || v_order.order_number || ' is on its way to you.'),
    ('delivered',          'Delivered',          'Order ' || v_order.order_number || ' has been delivered. Enjoy your meal!'),
    ('collected',          'Order collected',    'Thank you for collecting order ' || v_order.order_number || '. Enjoy your meal!'),
    ('rejected',           'Order not accepted', 'Sorry, Orange Kitchen could not accept order ' || v_order.order_number || '. A full refund will be issued.'),
    ('cancelled',          'Order cancelled',    'Order ' || v_order.order_number || ' has been cancelled. Any payment made will be refunded.')
  ) as t(status, title, body)
  where t.status = new.to_status;

  if v_title is not null then
    insert into public.notifications (user_id, order_id, channel, event_type, title, body, status, sent_at)
    values (v_order.customer_id, v_order.id, 'in_app', 'order.' || new.to_status, v_title, v_body, 'sent', now());
  end if;
  return new;
end $$;

create trigger order_status_history_notify
  after insert on public.order_status_history
  for each row execute function public.notify_order_status_change();

-- ---------------------------------------------------------------------
-- Pickup slot capacity (counts live orders in a slot on a date)
-- ---------------------------------------------------------------------
create or replace function public.pickup_slot_usage(p_date date)
returns table (slot_id uuid, used int)
language sql stable security definer set search_path = public as $$
  select pickup_slot_id, count(*)::int
    from public.orders
   where fulfillment = 'takeaway'
     and pickup_date = p_date
     and status not in ('expired', 'cancelled', 'rejected', 'payment_failed')
   group by pickup_slot_id;
$$;

-- ---------------------------------------------------------------------
-- Rate limiting (fixed window). Returns true when the call is allowed.
-- ---------------------------------------------------------------------
create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits int;
begin
  insert into public.rate_limits (key, window_start, hits) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = public.rate_limits.hits + 1
  returning hits into v_hits;

  -- opportunistic cleanup
  if random() < 0.01 then
    delete from public.rate_limits where window_start < now() - interval '1 day';
  end if;
  return v_hits <= p_max;
end $$;

-- ---------------------------------------------------------------------
-- Reporting (security invoker: callers only see what RLS allows,
-- and the guard below restricts to staff)
-- Revenue counts orders that were paid and not refunded-away.
-- ---------------------------------------------------------------------
create or replace function public.report_paid_statuses()
returns public.order_status[] language sql immutable as $$
  select array['payment_confirmed','accepted','preparing','ready','delivery_assigned',
               'picked_up','out_for_delivery','delivered','collected']::public.order_status[];
$$;

create or replace function public.report_sales_summary(p_from timestamptz, p_to timestamptz)
returns table (
  orders_count bigint,
  revenue numeric,
  avg_order_value numeric,
  delivery_orders bigint,
  delivery_revenue numeric,
  takeaway_orders bigint,
  takeaway_revenue numeric,
  cancelled_orders bigint,
  completed_orders bigint,
  pending_orders bigint
) language plpgsql stable security invoker set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select
    count(*) filter (where o.status = any (public.report_paid_statuses())),
    coalesce(sum(o.total_amount) filter (where o.status = any (public.report_paid_statuses())), 0),
    coalesce(round(avg(o.total_amount) filter (where o.status = any (public.report_paid_statuses())), 2), 0),
    count(*) filter (where o.fulfillment = 'delivery' and o.status = any (public.report_paid_statuses())),
    coalesce(sum(o.total_amount) filter (where o.fulfillment = 'delivery' and o.status = any (public.report_paid_statuses())), 0),
    count(*) filter (where o.fulfillment = 'takeaway' and o.status = any (public.report_paid_statuses())),
    coalesce(sum(o.total_amount) filter (where o.fulfillment = 'takeaway' and o.status = any (public.report_paid_statuses())), 0),
    count(*) filter (where o.status in ('cancelled', 'rejected')),
    count(*) filter (where o.status in ('delivered', 'collected')),
    count(*) filter (where o.status in ('payment_confirmed', 'accepted', 'preparing', 'ready', 'delivery_assigned', 'picked_up', 'out_for_delivery'))
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to;
end $$;

create or replace function public.report_sales_by_period(p_from timestamptz, p_to timestamptz, p_bucket text default 'day')
returns table (bucket date, orders_count bigint, revenue numeric, delivery_revenue numeric, takeaway_revenue numeric)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'INVALID_BUCKET';
  end if;
  return query
  select
    date_trunc(p_bucket, o.created_at at time zone 'Asia/Kolkata')::date,
    count(*),
    sum(o.total_amount),
    coalesce(sum(o.total_amount) filter (where o.fulfillment = 'delivery'), 0),
    coalesce(sum(o.total_amount) filter (where o.fulfillment = 'takeaway'), 0)
  from public.orders o
  where o.created_at >= p_from and o.created_at < p_to
    and o.status = any (public.report_paid_statuses())
  group by 1
  order by 1;
end $$;

create or replace function public.report_top_items(p_from timestamptz, p_to timestamptz, p_limit int default 10)
returns table (menu_item_id uuid, item_name text, quantity bigint, revenue numeric)
language plpgsql stable security invoker set search_path = public as $$
begin
  if not public.is_staff() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select oi.menu_item_id, min(oi.item_name), sum(oi.quantity)::bigint, sum(oi.line_total)
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
   where o.created_at >= p_from and o.created_at < p_to
     and o.status = any (public.report_paid_statuses())
   group by oi.menu_item_id
   order by 3 desc, 4 desc
   limit least(greatest(p_limit, 1), 100);
end $$;

-- ---------------------------------------------------------------------
-- Privileges: mutating functions are service-role only
-- ---------------------------------------------------------------------
revoke execute on function public.transition_order_status(uuid, public.order_status, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.confirm_payment(text, text, numeric, text, text) from public, anon, authenticated;
revoke execute on function public.record_payment_failure(text, text, text) from public, anon, authenticated;
revoke execute on function public.expire_unpaid_orders() from public, anon, authenticated;
revoke execute on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
revoke execute on function public.pickup_slot_usage(date) from public, anon;
grant execute on function public.transition_order_status(uuid, public.order_status, uuid, text, text) to service_role;
grant execute on function public.confirm_payment(text, text, numeric, text, text) to service_role;
grant execute on function public.record_payment_failure(text, text, text) to service_role;
grant execute on function public.expire_unpaid_orders() to service_role;
grant execute on function public.check_rate_limit(text, int, int) to service_role;
grant execute on function public.pickup_slot_usage(date) to authenticated, service_role;
