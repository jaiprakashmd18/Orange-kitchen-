-- =====================================================================
-- Orange Kitchen — Row Level Security
-- Principles:
--  * Every table has RLS enabled. Default = deny.
--  * Customers read/write only their own rows.
--  * Riders read only orders currently assigned to them.
--  * Staff/admin access is checked with user_roles via security-definer
--    helpers (is_staff / is_admin) — never from client-supplied claims.
--  * Orders, order items, payments and webhook events are WRITTEN only by
--    the service role (server routes) so totals and statuses can never be
--    forged from the browser.
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','customer_addresses','user_roles','menu_categories','menu_items','menu_item_availability',
    'carts','cart_items','orders','order_status_history','order_items','payments','payment_webhook_events',
    'coupons','coupon_redemptions','delivery_personnel','delivery_assignments','delivery_providers',
    'delivery_events','restaurant_settings','operating_hours','holiday_closures','serviceable_areas',
    'pickup_slots','notifications','reviews','audit_logs','contact_messages','rate_limits'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Customers may not change their email through the profile row (auth owns it)
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_url, marketing_opt_in, whatsapp_opt_in, favourite_item_ids) on public.profiles to authenticated;

-- ---------------------------------------------------------------------
-- customer_addresses
-- ---------------------------------------------------------------------
create policy addresses_select on public.customer_addresses for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy addresses_insert on public.customer_addresses for insert to authenticated
  with check (user_id = auth.uid());
create policy addresses_update on public.customer_addresses for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_delete on public.customer_addresses for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- user_roles (read own; admins manage)
-- ---------------------------------------------------------------------
create policy user_roles_select on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy user_roles_admin_write on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Menu (public read of published data; staff manage)
-- ---------------------------------------------------------------------
create policy menu_categories_public_read on public.menu_categories for select to anon, authenticated
  using (is_active or public.is_staff());
create policy menu_categories_staff_write on public.menu_categories for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy menu_items_public_read on public.menu_items for select to anon, authenticated
  using (is_published or public.is_staff());
create policy menu_items_staff_write on public.menu_items for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

create policy menu_item_availability_public_read on public.menu_item_availability for select to anon, authenticated
  using (true);
create policy menu_item_availability_staff_write on public.menu_item_availability for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------
-- Carts (owner only)
-- ---------------------------------------------------------------------
create policy carts_owner on public.carts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_owner on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));

-- ---------------------------------------------------------------------
-- Orders (read-only from the client; writes via service role)
-- ---------------------------------------------------------------------
create policy orders_select on public.orders for select to authenticated
  using (
    customer_id = auth.uid()
    or public.is_staff()
    or public.is_assigned_rider(id)
  );

create policy order_items_select on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));  -- inherits orders RLS

create policy order_status_history_select on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id));

create policy payments_select on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.customer_id = auth.uid() or public.is_staff())));

create policy payment_webhook_events_admin on public.payment_webhook_events for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- Coupons: never listable by customers (validated server-side)
-- ---------------------------------------------------------------------
create policy coupons_staff on public.coupons for select to authenticated using (public.is_staff());
create policy coupons_admin_write on public.coupons for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy coupon_redemptions_select on public.coupon_redemptions for select to authenticated
  using (user_id = auth.uid() or public.is_staff());

-- ---------------------------------------------------------------------
-- Delivery
-- ---------------------------------------------------------------------
create policy delivery_personnel_select on public.delivery_personnel for select to authenticated
  using (user_id = auth.uid() or public.is_staff());
create policy delivery_personnel_admin_write on public.delivery_personnel for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- Riders toggle on-duty via the server API (service role); no direct self-update.

create policy delivery_assignments_select on public.delivery_assignments for select to authenticated
  using (public.is_staff() or personnel_id = public.current_rider_id() or public.is_order_customer(order_id));

create policy delivery_providers_staff on public.delivery_providers for select to authenticated using (public.is_staff());
create policy delivery_providers_admin_write on public.delivery_providers for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy delivery_events_select on public.delivery_events for select to authenticated
  using (public.is_staff() or exists (
    select 1 from public.delivery_assignments da where da.id = assignment_id and da.personnel_id = public.current_rider_id()));

-- ---------------------------------------------------------------------
-- Restaurant configuration (public read, admin write)
-- ---------------------------------------------------------------------
create policy restaurant_settings_public_read on public.restaurant_settings for select to anon, authenticated using (true);
create policy restaurant_settings_admin_write on public.restaurant_settings for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy operating_hours_public_read on public.operating_hours for select to anon, authenticated using (true);
create policy operating_hours_admin_write on public.operating_hours for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy holiday_closures_public_read on public.holiday_closures for select to anon, authenticated using (true);
create policy holiday_closures_admin_write on public.holiday_closures for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy serviceable_areas_public_read on public.serviceable_areas for select to anon, authenticated
  using (is_active or public.is_staff());
create policy serviceable_areas_admin_write on public.serviceable_areas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy pickup_slots_public_read on public.pickup_slots for select to anon, authenticated
  using (is_active or public.is_staff());
create policy pickup_slots_admin_write on public.pickup_slots for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Notifications (owner reads & marks read)
-- ---------------------------------------------------------------------
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy notifications_mark_read on public.notifications for update to authenticated
  using (user_id = auth.uid() and channel = 'in_app') with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- Reviews: public sees approved; customers write for own completed order
-- ---------------------------------------------------------------------
create policy reviews_public_read on public.reviews for select to anon, authenticated
  using (is_approved or user_id = auth.uid() or public.is_staff());
create policy reviews_insert_own on public.reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_approved = false and is_featured = false
    and exists (select 1 from public.orders o where o.id = order_id and o.customer_id = auth.uid()
                and o.status in ('delivered', 'collected'))
  );
create policy reviews_staff_moderate on public.reviews for update to authenticated
  using (public.is_staff()) with check (public.is_staff());
create policy reviews_staff_delete on public.reviews for delete to authenticated
  using (public.is_staff() or user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Audit logs: admin read only (written by service role / definer funcs)
-- ---------------------------------------------------------------------
create policy audit_logs_admin_read on public.audit_logs for select to authenticated using (public.is_admin());

-- Contact messages: inserted via server route (service role); staff read/resolve
create policy contact_messages_staff on public.contact_messages for select to authenticated using (public.is_staff());
create policy contact_messages_staff_update on public.contact_messages for update to authenticated
  using (public.is_staff()) with check (public.is_staff());

-- rate_limits: no policies -> service role only.

-- ---------------------------------------------------------------------
-- Realtime: stream order changes (RLS is applied to subscribers)
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.orders, public.order_status_history,
      public.notifications, public.delivery_assignments;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Storage: public bucket for menu/brand images; staff-only uploads
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('public-media', 'public-media', true, 5242880, array['image/jpeg','image/png','image/webp','image/avif','image/svg+xml'])
    on conflict (id) do nothing;

    execute $p$create policy "public-media read" on storage.objects for select to anon, authenticated
      using (bucket_id = 'public-media')$p$;
    execute $p$create policy "public-media staff insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'public-media' and public.is_staff())$p$;
    execute $p$create policy "public-media staff update" on storage.objects for update to authenticated
      using (bucket_id = 'public-media' and public.is_staff())$p$;
    execute $p$create policy "public-media staff delete" on storage.objects for delete to authenticated
      using (bucket_id = 'public-media' and public.is_staff())$p$;
  end if;
end $$;
