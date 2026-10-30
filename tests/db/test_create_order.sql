-- create_order_with_items: atomic insert + pickup capacity
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'carol@example.com');
insert into public.pickup_slots (id, day_of_week, start_time, end_time, max_orders)
values ('30000000-0000-0000-0000-000000000001', 5, '12:00', '12:30', 1);

select public.create_order_with_items(
  jsonb_build_object('customer_id','00000000-0000-0000-0000-0000000000c1','idempotency_key','carol-key-0000000001',
    'fulfillment','takeaway','subtotal',350,'total_amount',350,'pickup_slot_id','30000000-0000-0000-0000-000000000001',
    'pickup_date','2026-10-30','pickup_time','12:00','customer_name','Carol','customer_phone','9876543210',
    'payment_due_at', now() + interval '20 min'),
  jsonb_build_array(jsonb_build_object('menu_item_id', (select id from public.menu_items where slug='crab-gravy'),
    'item_name','Crab Gravy','is_veg',false,'unit_price',350,'quantity',1,'line_total',350)));

do $$ begin
  assert (select count(*) from public.order_items oi join public.orders o on o.id = oi.order_id
          where o.customer_id = '00000000-0000-0000-0000-0000000000c1') = 1, 'items inserted';
  assert (select count(*) from public.order_status_history h join public.orders o on o.id = h.order_id
          where o.customer_id = '00000000-0000-0000-0000-0000000000c1' and h.to_status = 'pending_payment') = 1, 'history';
  begin
    perform public.create_order_with_items(
      jsonb_build_object('customer_id','00000000-0000-0000-0000-0000000000c1','idempotency_key','carol-key-0000000002',
        'fulfillment','takeaway','subtotal',350,'total_amount',350,'pickup_slot_id','30000000-0000-0000-0000-000000000001',
        'pickup_date','2026-10-30','pickup_time','12:00','customer_name','Carol','customer_phone','9876543210',
        'payment_due_at', now()),
      jsonb_build_array(jsonb_build_object('menu_item_id', null, 'item_name','X','is_veg',true,'unit_price',1,'quantity',1,'line_total',1)));
    raise exception 'slot should be full';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'SLOT_FULL' then raise; end if;
  end;
  -- bad item rolls back the whole order
  begin
    perform public.create_order_with_items(
      jsonb_build_object('customer_id','00000000-0000-0000-0000-0000000000c1','idempotency_key','carol-key-0000000003',
        'fulfillment','delivery','subtotal',1,'total_amount',1,'delivery_address','{}'::jsonb,'customer_name','Carol',
        'customer_phone','9876543210','payment_due_at', now()),
      jsonb_build_array(jsonb_build_object('item_name','X','is_veg',true,'unit_price',-5,'quantity',1,'line_total',1)));
    raise exception 'negative price should fail';
  exception when check_violation then null; end;
  assert not exists (select 1 from public.orders where idempotency_key = 'carol-key-0000000003'), 'rolled back';
end $$;

-- expiry
update public.orders set payment_due_at = now() - interval '1 min' where idempotency_key = 'carol-key-0000000001';
do $$ begin
  assert public.expire_unpaid_orders() = 1, 'one expired';
  assert (select status from public.orders where idempotency_key = 'carol-key-0000000001') = 'expired', 'status expired';
end $$;
do $$ begin raise notice 'create order tests passed'; end $$;
