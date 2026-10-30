-- =====================================================================
-- Orange Kitchen — initial data
-- Only facts supplied by the restaurant are seeded. Everything else
-- (prices, descriptions, hours, delivery areas, fees, tax) is left empty
-- and must be entered in the admin dashboard before ordering is opened.
-- `accepting_orders` starts FALSE for that reason.
-- =====================================================================

insert into public.restaurant_settings (
  id, name, tagline, phone, address_line1, address_line2, city, state, pincode, country,
  currency, timezone, accepting_orders, cancellation_policy, refund_policy, pickup_instructions
) values (
  1,
  'Orange Kitchen',
  'Freshly Prepared. Deliciously Served.',
  '+918072272313',
  'Shop 32, Pillaiyar Koil Street',
  'Surapet Service Road',
  'Chennai',
  'Tamil Nadu',
  '600066',
  'India',
  'INR',
  'Asia/Kolkata',
  false,
  -- Describes how the platform actually behaves; review and edit in Admin → Settings.
  'You can cancel an order from your account until the restaurant accepts it. Once the restaurant has accepted an order and started preparing it, it can no longer be cancelled online — please call us. Orders not accepted by the restaurant are cancelled automatically and refunded in full.',
  'Online payments for orders that are cancelled before acceptance, or declined by the restaurant, are refunded in full to the original payment method. Refunds are initiated immediately and usually reach your account within 5–7 business days, depending on your bank. Cash on delivery is not available.',
  null
) on conflict (id) do nothing;

-- Menu structure supplied by the restaurant -------------------------------
insert into public.menu_categories (name, slug, sort_order) values
  ('Breakfast', 'breakfast', 10),
  ('Lunch', 'lunch', 20),
  ('Special Gravies', 'special-gravies', 30)
on conflict (slug) do nothing;

insert into public.menu_categories (name, slug, parent_id, sort_order)
select v.name, v.slug, p.id, v.sort_order
from (values
  ('Idly', 'idly', 'breakfast', 11),
  ('Dosa', 'dosa', 'breakfast', 12),
  ('Vada', 'vada', 'breakfast', 13),
  ('Poori', 'poori', 'breakfast', 14),
  ('Pongal', 'pongal', 'breakfast', 15),
  ('Full Meals', 'full-meals', 'lunch', 21),
  ('Variety Rice', 'variety-rice', 'lunch', 22),
  ('Kuzhambu / Gravies', 'kuzhambu-gravies', 'lunch', 23),
  ('Seafood', 'seafood', 'lunch', 24),
  ('Chicken Specials', 'chicken-specials', 'lunch', 25)
) as v(name, slug, parent_slug, sort_order)
join public.menu_categories p on p.slug = v.parent_slug
on conflict (slug) do nothing;

-- Named dishes without prices are created as unpublished drafts.
-- The admin must add the price (and confirm veg/non-veg) before publishing.
insert into public.menu_items (category_id, name, slug, is_veg, is_published, sort_order)
select c.id, v.name, v.slug, v.is_veg, false, v.sort_order
from (values
  ('Crab Gravy', 'crab-gravy', false, 1),
  ('Kabanda Gravy', 'kabanda-gravy', null::boolean, 2),
  ('Sura Puttu', 'sura-puttu', false, 3)
) as v(name, slug, is_veg, sort_order)
join public.menu_categories c on c.slug = 'special-gravies'
on conflict (slug) do nothing;

-- Third-party delivery: a manual provider record so staff can log
-- external bookings (reference + tracking link) without any API.
insert into public.delivery_providers (name, code, adapter, is_active, notes)
values ('Manual / Other partner', 'manual', 'manual', true,
        'Use for any delivery partner booked outside this system. Enter the booking reference and tracking link by hand.')
on conflict (code) do nothing;
