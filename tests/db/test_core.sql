-- Core behavioural tests for schema, state machine and RLS.
\set QUIET on
do $$ begin raise notice 'setup'; end $$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com', '{"full_name":"Alice"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com', '{"full_name":"Bob"}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@example.com', '{}'),
  ('00000000-0000-0000-0000-0000000000de', 'rider@example.com', '{}');

insert into public.user_roles (user_id, role) values
  ('00000000-0000-0000-0000-0000000000ad', 'admin'),
  ('00000000-0000-0000-0000-0000000000de', 'delivery');
insert into public.delivery_personnel (id, user_id, full_name, phone)
  values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000de', 'Ravi', '9876543210');

-- profile trigger
do $$ begin
  assert (select count(*) from public.profiles) = 4, 'profiles created by trigger';
  assert (select full_name from public.profiles where email = 'alice@example.com') = 'Alice', 'full_name copied';
end $$;

-- publish constraint
do $$ begin
  begin
    update public.menu_items set is_published = true where slug = 'crab-gravy';
    raise exception 'should have failed';
  exception when check_violation then null; end;
end $$;

update public.menu_items set price = 350, is_published = true where slug = 'crab-gravy';

insert into public.orders (id, customer_id, idempotency_key, fulfillment, subtotal, total_amount,
  customer_name, customer_phone, payment_due_at, delivery_address)
values ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000a', 'idem-key-aaaaaaaaaaaa',
  'delivery', 350, 350, 'Alice', '9876543210', now() + interval '20 min', '{"pincode":"600066"}');
insert into public.payments (order_id, provider_order_id, amount)
values ('20000000-0000-0000-0000-000000000001', 'order_TEST1', 350);

do $$ begin
  assert (select order_number from public.orders limit 1) like 'OK%-1001', 'order number generated';
end $$;

-- duplicate idempotency key rejected
do $$ begin
  begin
    insert into public.orders (customer_id, idempotency_key, fulfillment, subtotal, total_amount,
      customer_name, customer_phone, payment_due_at, delivery_address)
    values ('00000000-0000-0000-0000-00000000000a', 'idem-key-aaaaaaaaaaaa', 'delivery', 1, 1, 'A', '9876543210', now(), '{}');
    raise exception 'dup should fail';
  exception when unique_violation then null; end;
end $$;

-- takeaway cannot carry a delivery fee
do $$ begin
  begin
    insert into public.orders (customer_id, idempotency_key, fulfillment, subtotal, delivery_fee, total_amount,
      customer_name, customer_phone, payment_due_at, pickup_date, pickup_time)
    values ('00000000-0000-0000-0000-00000000000a', 'idem-key-bbbbbbbbbbbb', 'takeaway', 100, 20, 120, 'A', '9876543210', now(), current_date, '12:00');
    raise exception 'fee should fail';
  exception when check_violation then null; end;
end $$;

-- illegal transition
do $$ begin
  begin
    perform public.transition_order_status('20000000-0000-0000-0000-000000000001', 'accepted');
    raise exception 'should be illegal';
  exception when sqlstate 'P0001' then null; end;
end $$;

-- amount mismatch refused
do $$ begin
  begin
    perform public.confirm_payment('order_TEST1', 'pay_X', 1.00, 'upi', 'signature');
    raise exception 'mismatch should fail';
  exception when sqlstate 'P0001' then null; end;
end $$;

-- confirm payment twice -> idempotent
select public.confirm_payment('order_TEST1', 'pay_X', 350.00, 'upi', 'signature');
select public.confirm_payment('order_TEST1', 'pay_X', 350.00, 'upi', 'webhook');
do $$ begin
  assert (select status from public.orders where id = '20000000-0000-0000-0000-000000000001') = 'payment_confirmed', 'paid';
  assert (select count(*) from public.order_status_history where to_status = 'payment_confirmed') = 1, 'one history row';
  assert (select count(*) from public.notifications where event_type = 'order.payment_confirmed') = 1, 'one notification';
end $$;

-- failure after capture must not downgrade
select public.record_payment_failure('order_TEST1', 'pay_Y', 'late failure');
do $$ begin
  assert (select status from public.payments where provider_order_id = 'order_TEST1') = 'captured', 'not downgraded';
end $$;

-- assign rider before ready, then ready auto-advances
select public.transition_order_status('20000000-0000-0000-0000-000000000001', 'accepted');
select public.transition_order_status('20000000-0000-0000-0000-000000000001', 'preparing');
insert into public.delivery_assignments (order_id, mode, personnel_id)
values ('20000000-0000-0000-0000-000000000001', 'own', '10000000-0000-0000-0000-000000000001');
select public.transition_order_status('20000000-0000-0000-0000-000000000001', 'ready');
do $$ begin
  assert (select status from public.orders where id = '20000000-0000-0000-0000-000000000001') = 'delivery_assigned', 'auto-advanced';
end $$;

-- ---------------- RLS ----------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.orders) = 0, 'bob cannot see alice order';
  assert (select count(*) from public.profiles) = 1, 'bob sees only own profile';
  assert (select count(*) from public.payments) = 0, 'bob cannot see payments';
  assert (select count(*) from public.coupons) = 0, 'customers cannot list coupons';
  begin
    insert into public.orders (customer_id, idempotency_key, fulfillment, subtotal, total_amount,
      customer_name, customer_phone, payment_due_at, delivery_address)
    values ('00000000-0000-0000-0000-00000000000b', 'idem-key-cccccccccccc', 'delivery', 1, 1, 'B', '9876543210', now(), '{}');
    raise exception 'client insert into orders should fail';
  exception when insufficient_privilege then null; end;
  begin
    perform public.transition_order_status('20000000-0000-0000-0000-000000000001', 'cancelled');
    raise exception 'customer must not call transition';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.user_roles (user_id, role) values ('00000000-0000-0000-0000-00000000000b', 'admin');
    raise exception 'self-escalation should fail';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  assert (select count(*) from public.orders) = 1, 'alice sees own order';
  assert (select count(*) from public.order_status_history) >= 4, 'alice sees history';
  assert (select count(*) from public.delivery_assignments) = 1, 'alice sees assignment';
  begin
    update public.profiles set email = 'x@y.z' where id = auth.uid();
    raise exception 'email update should fail';
  exception when insufficient_privilege then null; end;
end $$;
update public.profiles set full_name = 'Alice K' where id = auth.uid();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000de', false);
do $$ begin
  assert (select count(*) from public.orders) = 1, 'rider sees assigned order';
  assert (select count(*) from public.profiles) = 1, 'rider sees only own profile';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
do $$ begin
  assert (select count(*) from public.orders) = 1, 'admin sees all';
  assert (select count(*) from public.menu_items) = 3, 'admin sees drafts';
  assert (select orders_count from public.report_sales_summary(now() - interval '1 day', now() + interval '1 day')) = 1, 'report works';
end $$;
update public.restaurant_settings set accepting_orders = true where id = 1;

reset role;
select set_config('request.jwt.claim.sub', '', false);
set role anon;
do $$ begin
  assert (select count(*) from public.menu_items) = 1, 'anon sees published only';
  assert (select count(*) from public.orders) = 0, 'anon sees no orders';
  assert (select count(*) from public.reviews) = 0, 'no reviews';
end $$;
reset role;

do $$ begin raise notice 'core tests passed'; end $$;
