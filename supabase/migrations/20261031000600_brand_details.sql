-- =====================================================================
-- Details from the official Orange Kitchen logo and banner:
--  * meal periods: Breakfast, Lunch, Dinner, Tea & Coffee
--  * WhatsApp ordering on +91 80722 72313 (banner "Order now on" WhatsApp)
-- Only fills empty values, so anything edited in Admin is never overwritten.
-- =====================================================================

insert into public.menu_categories (name, slug, sort_order) values
  ('Dinner', 'dinner', 40),
  ('Tea & Coffee', 'tea-coffee', 50)
on conflict (slug) do nothing;

update public.restaurant_settings
   set whatsapp = '+918072272313'
 where id = 1 and whatsapp is null;
