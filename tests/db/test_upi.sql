-- Direct UPI: verification_pending is not expired; UTR is single-use; failure path.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'upi@example.com');
insert into public.orders (id, customer_id, idempotency_key, fulfillment, subtotal, total_amount, customer_name, customer_phone, payment_due_at, delivery_address)
values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000e1', 'upi-key-000000000001', 'delivery', 200, 200, 'U', '9876543210', now() - interval '1 min', '{}'),
       ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000e1', 'upi-key-000000000002', 'delivery', 300, 300, 'U', '9876543210', now() + interval '20 min', '{}');
insert into public.payments (order_id, provider, provider_order_id, amount, status, provider_payment_id)
values ('40000000-0000-0000-0000-000000000001', 'upi', 'upi_1', 200, 'verification_pending', '123456789012'),
       ('40000000-0000-0000-0000-000000000002', 'upi', 'upi_2', 300, 'created', null);

do $$ begin
  perform public.expire_unpaid_orders();
  assert (select status from public.orders where id = '40000000-0000-0000-0000-000000000001') = 'pending_payment', 'awaiting verification is not expired';
  begin
    update public.payments set provider_payment_id = '123456789012' where provider_order_id = 'upi_2';
    raise exception 'reused UTR should fail';
  exception when unique_violation then null; end;
end $$;

select public.confirm_payment('upi_1', '123456789012', 200, 'upi', 'manual');
do $$ begin
  assert (select status from public.orders where id = '40000000-0000-0000-0000-000000000001') = 'payment_confirmed', 'manual confirm works';
end $$;

update public.payments set status = 'verification_pending', provider_payment_id = '999999999999' where provider_order_id = 'upi_2';
select public.record_payment_failure('upi_2', null, 'Not received in UPI app');
do $$ begin
  assert (select status from public.payments where provider_order_id = 'upi_2') = 'failed', 'rejected';
  assert (select status from public.orders where id = '40000000-0000-0000-0000-000000000002') = 'payment_failed', 'order payment_failed';
end $$;

-- settings constraints
do $$ begin
  begin
    update public.restaurant_settings set upi_enabled = true, upi_id = null where id = 1;
    raise exception 'upi without id should fail';
  exception when check_violation then null; end;
  begin
    update public.restaurant_settings set upi_id = 'not a upi' where id = 1;
    raise exception 'bad upi id should fail';
  exception when check_violation then null; end;
  update public.restaurant_settings set upi_enabled = true, upi_id = 'orangekitchen@okaxis' where id = 1;
end $$;
do $$ begin raise notice 'upi tests passed'; end $$;
