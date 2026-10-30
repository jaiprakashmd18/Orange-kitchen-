-- =====================================================================
-- Orange Kitchen — core schema
-- Tables, enums, constraints, indexes and timestamp triggers.
-- RLS policies live in 20261030000200_rls.sql
-- Business functions live in 20261030000300_functions.sql
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.app_role as enum ('admin', 'staff', 'delivery');

create type public.fulfillment_type as enum ('delivery', 'takeaway');

create type public.order_status as enum (
  'pending_payment',     -- created, awaiting successful payment
  'payment_failed',      -- last attempt failed; customer may retry
  'expired',             -- never paid within the payment window
  'payment_confirmed',   -- paid & verified server-side, awaiting restaurant
  'accepted',
  'preparing',
  'ready',               -- ready for pickup (by rider or customer)
  'delivery_assigned',
  'picked_up',           -- rider collected food from restaurant
  'out_for_delivery',
  'delivered',
  'collected',           -- takeaway: picked up by customer
  'rejected',            -- restaurant declined (refund due)
  'cancelled'            -- cancelled after payment (refund due)
);

create type public.payment_status as enum (
  'created', 'authorized', 'captured', 'failed', 'refund_pending', 'refunded', 'partially_refunded'
);

create type public.discount_type as enum ('percent', 'flat');

create type public.delivery_mode as enum ('own', 'third_party');

create type public.assignment_status as enum (
  'assigned', 'accepted', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled', 'failed'
);

create type public.notification_channel as enum ('in_app', 'email', 'whatsapp');

create type public.notification_status as enum ('pending', 'sent', 'failed', 'skipped', 'read');

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 1. profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  email citext,
  phone text check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  avatar_url text,
  marketing_opt_in boolean not null default false,
  whatsapp_opt_in boolean not null default false,
  favourite_item_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. customer_addresses
-- ---------------------------------------------------------------------
create table public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home' check (char_length(label) between 1 and 40),
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  house text not null check (char_length(house) between 1 and 120),
  street text not null check (char_length(street) between 1 and 160),
  area text not null check (char_length(area) between 1 and 120),
  landmark text check (char_length(landmark) <= 120),
  city text not null default 'Chennai' check (char_length(city) between 2 and 80),
  state text not null default 'Tamil Nadu' check (char_length(state) between 2 and 80),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  delivery_instructions text check (char_length(delivery_instructions) <= 300),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index customer_addresses_user_idx on public.customer_addresses (user_id);
create unique index customer_addresses_one_default on public.customer_addresses (user_id) where is_default;

-- ---------------------------------------------------------------------
-- 3. user_roles (customers have no row; staff roles are explicit)
-- ---------------------------------------------------------------------
create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  granted_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- ---------------------------------------------------------------------
-- 4. menu_categories
-- ---------------------------------------------------------------------
create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 500),
  image_url text,
  parent_id uuid references public.menu_categories (id) on delete set null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index menu_categories_parent_idx on public.menu_categories (parent_id);

-- ---------------------------------------------------------------------
-- 5. menu_items
-- price is NULL until the restaurant enters it; an item cannot be
-- published (shown/orderable) without a price.
-- options: [{ "id": "spice", "name": "Spice level", "required": true,
--             "max": 1, "choices": [{ "id": "mild", "label": "Mild", "price_delta": 0 }] }]
-- ---------------------------------------------------------------------
create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.menu_categories (id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 1000),
  price numeric(10, 2) check (price is null or price >= 0),
  image_url text,
  is_veg boolean,                                   -- null until confirmed by the restaurant
  is_published boolean not null default false,
  is_available boolean not null default true,       -- false = sold out today
  is_popular boolean not null default false,
  is_special boolean not null default false,
  special_from date,
  special_until date,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  max_per_order int not null default 20 check (max_per_order between 1 and 100),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint menu_items_publish_requires_price check (not is_published or (price is not null and is_veg is not null)),
  constraint menu_items_special_range check (special_until is null or special_from is null or special_until >= special_from)
);
create index menu_items_category_idx on public.menu_items (category_id, sort_order);
create index menu_items_published_idx on public.menu_items (is_published, is_available);

-- ---------------------------------------------------------------------
-- 6. menu_item_availability — optional time windows per weekday.
-- No rows for an item = available whenever the restaurant is open.
-- ---------------------------------------------------------------------
create table public.menu_item_availability (
  id uuid primary key default gen_random_uuid(),
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time)
);
create index menu_item_availability_item_idx on public.menu_item_availability (menu_item_id, day_of_week);

-- ---------------------------------------------------------------------
-- 7/8. carts & cart_items (server-synced cart for signed-in customers)
-- ---------------------------------------------------------------------
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete cascade,
  special_instructions text check (char_length(special_instructions) <= 500),
  coupon_code citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  quantity int not null check (quantity between 1 and 100),
  selected_options jsonb not null default '{}'::jsonb,
  options_key text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cart_id, menu_item_id, options_key)
);
create index cart_items_cart_idx on public.cart_items (cart_id);

-- ---------------------------------------------------------------------
-- 19. restaurant_settings (singleton row id = 1)
-- ---------------------------------------------------------------------
create table public.restaurant_settings (
  id smallint primary key default 1 check (id = 1),
  name text not null default 'Orange Kitchen',
  tagline text not null default 'Freshly Prepared. Deliciously Served.',
  logo_url text,
  announcement text,
  phone text,
  whatsapp text,
  email citext,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  pincode text,
  country text not null default 'India',
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  google_maps_url text,
  google_maps_embed_url text,
  social_links jsonb not null default '{}'::jsonb,  -- { "instagram": "...", "facebook": "...", ... }
  currency text not null default 'INR',
  timezone text not null default 'Asia/Kolkata',
  accepting_orders boolean not null default false,
  delivery_enabled boolean not null default true,
  takeaway_enabled boolean not null default true,
  delivery_mode_default public.delivery_mode not null default 'own',
  min_order_amount numeric(10, 2) not null default 0 check (min_order_amount >= 0),
  tax_rate_percent numeric(5, 2) not null default 0 check (tax_rate_percent between 0 and 50),
  tax_label text not null default 'GST',
  prices_include_tax boolean not null default false,
  packaging_charge numeric(10, 2) not null default 0 check (packaging_charge >= 0),
  prep_time_minutes int not null default 30 check (prep_time_minutes between 5 and 240),
  payment_window_minutes int not null default 20 check (payment_window_minutes between 5 and 120),
  pickup_instructions text,
  cancellation_policy text,
  refund_policy text,
  gstin text,
  fssai_license text,
  updated_by uuid references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 20. operating_hours (multiple windows per day allowed) + holidays
-- ---------------------------------------------------------------------
create table public.operating_hours (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  open_time time not null,
  close_time time not null,
  label text check (char_length(label) <= 40), -- e.g. "Breakfast", "Lunch"
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (close_time > open_time)
);
create index operating_hours_day_idx on public.operating_hours (day_of_week);

create table public.holiday_closures (
  id uuid primary key default gen_random_uuid(),
  closed_on date not null unique,
  reason text check (char_length(reason) <= 160),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 21. serviceable_areas (delivery zones by pincode)
-- ---------------------------------------------------------------------
create table public.serviceable_areas (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  pincode text not null check (pincode ~ '^[1-9][0-9]{5}$'),
  delivery_fee numeric(10, 2) not null check (delivery_fee >= 0),
  free_delivery_above numeric(10, 2) check (free_delivery_above is null or free_delivery_above >= 0),
  min_order_amount numeric(10, 2) not null default 0 check (min_order_amount >= 0),
  estimated_minutes int not null default 45 check (estimated_minutes between 5 and 240),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pincode, name)
);
create index serviceable_areas_pincode_idx on public.serviceable_areas (pincode) where is_active;

-- ---------------------------------------------------------------------
-- 22. pickup_slots (recurring weekly slot templates with capacity)
-- ---------------------------------------------------------------------
create table public.pickup_slots (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  max_orders int not null default 10 check (max_orders between 1 and 500),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (day_of_week, start_time)
);

-- ---------------------------------------------------------------------
-- 13/14. coupons & coupon_redemptions
-- ---------------------------------------------------------------------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique check (code ~* '^[A-Z0-9_-]{3,30}$'),
  description text check (char_length(description) <= 200),
  discount_type public.discount_type not null,
  discount_value numeric(10, 2) not null check (discount_value > 0),
  max_discount numeric(10, 2) check (max_discount is null or max_discount > 0),
  min_order_amount numeric(10, 2) not null default 0 check (min_order_amount >= 0),
  valid_from timestamptz,
  valid_until timestamptz,
  usage_limit int check (usage_limit is null or usage_limit > 0),
  per_user_limit int not null default 1 check (per_user_limit > 0),
  applies_to public.fulfillment_type, -- null = both
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (valid_until is null or valid_from is null or valid_until > valid_from)
);

-- ---------------------------------------------------------------------
-- 15. delivery_personnel
-- ---------------------------------------------------------------------
create table public.delivery_personnel (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  phone text not null check (phone ~ '^\+?[0-9]{10,15}$'),
  vehicle_number text check (char_length(vehicle_number) <= 20),
  is_active boolean not null default true,
  is_on_duty boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 17. delivery_providers (third-party). Secrets are NEVER stored here:
-- credentials are read from env vars named <ENV_PREFIX>_API_KEY etc.
-- ---------------------------------------------------------------------
create table public.delivery_providers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  code text not null unique check (code ~ '^[a-z0-9_]{2,40}$'),
  adapter text not null default 'manual' check (adapter in ('manual', 'http_generic')),
  env_prefix text check (env_prefix ~ '^[A-Z][A-Z0-9_]{1,40}$'),
  api_base_url text,
  tracking_url_template text, -- e.g. https://track.example.com/{ref}
  contact_phone text,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 9. orders
-- ---------------------------------------------------------------------
create sequence public.order_number_seq start 1001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_id uuid not null references public.profiles (id) on delete restrict,
  idempotency_key text not null check (char_length(idempotency_key) between 16 and 80),
  fulfillment public.fulfillment_type not null,
  status public.order_status not null default 'pending_payment',
  -- money (INR, 2dp). All computed server-side.
  subtotal numeric(10, 2) not null check (subtotal >= 0),
  discount_amount numeric(10, 2) not null default 0 check (discount_amount >= 0),
  delivery_fee numeric(10, 2) not null default 0 check (delivery_fee >= 0),
  packaging_charge numeric(10, 2) not null default 0 check (packaging_charge >= 0),
  tax_amount numeric(10, 2) not null default 0 check (tax_amount >= 0),
  total_amount numeric(10, 2) not null check (total_amount > 0),
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code citext,
  special_instructions text check (char_length(special_instructions) <= 500),
  -- delivery snapshot (copied from address at checkout)
  delivery_address jsonb,
  serviceable_area_id uuid references public.serviceable_areas (id) on delete set null,
  delivery_mode public.delivery_mode,
  -- takeaway
  pickup_slot_id uuid references public.pickup_slots (id) on delete set null,
  pickup_date date,
  pickup_time time,
  -- contact snapshot
  customer_name text not null,
  customer_phone text not null,
  customer_email citext,
  estimated_ready_at timestamptz,
  estimated_delivery_at timestamptz,
  payment_due_at timestamptz not null,
  paid_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text check (char_length(cancellation_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (customer_id, idempotency_key),
  constraint orders_delivery_has_address check (fulfillment <> 'delivery' or delivery_address is not null),
  constraint orders_takeaway_no_fee check (fulfillment <> 'takeaway' or delivery_fee = 0),
  constraint orders_takeaway_has_slot check (fulfillment <> 'takeaway' or (pickup_date is not null and pickup_time is not null))
);
create index orders_customer_idx on public.orders (customer_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
create index orders_pickup_idx on public.orders (pickup_date, pickup_slot_id) where fulfillment = 'takeaway';

-- Timeline of every status change (drives the tracking page)
create table public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references auth.users (id),
  actor_role text,
  note text check (char_length(note) <= 300),
  created_at timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id, created_at);

-- ---------------------------------------------------------------------
-- 10. order_items (price snapshot)
-- ---------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  item_name text not null,
  is_veg boolean not null,
  unit_price numeric(10, 2) not null check (unit_price >= 0),   -- base + options
  quantity int not null check (quantity between 1 and 100),
  selected_options jsonb not null default '[]'::jsonb,           -- [{group, choice, price_delta}]
  line_total numeric(10, 2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_menu_item_idx on public.order_items (menu_item_id);

-- coupon redemptions (after orders exist)
create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  discount_amount numeric(10, 2) not null check (discount_amount >= 0),
  created_at timestamptz not null default now()
);
create index coupon_redemptions_coupon_user_idx on public.coupon_redemptions (coupon_id, user_id);

-- ---------------------------------------------------------------------
-- 11. payments (one row per Razorpay order; no card data ever stored)
-- ---------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete restrict,
  provider text not null default 'razorpay',
  provider_order_id text not null unique,
  provider_payment_id text unique,
  amount numeric(10, 2) not null check (amount > 0),
  currency text not null default 'INR',
  status public.payment_status not null default 'created',
  method text,               -- upi / card / netbanking / wallet (from Razorpay)
  attempts int not null default 0,
  failure_reason text,
  refund_id text,
  refunded_amount numeric(10, 2) not null default 0 check (refunded_amount >= 0),
  refunded_at timestamptz,
  verified_via text check (verified_via in ('signature', 'webhook')),
  captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_order_idx on public.payments (order_id);
create index payments_status_idx on public.payments (status, created_at desc);

-- ---------------------------------------------------------------------
-- 12. payment_webhook_events (dedupe + audit)
-- ---------------------------------------------------------------------
create table public.payment_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'razorpay',
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  signature_valid boolean not null,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);

-- ---------------------------------------------------------------------
-- 16. delivery_assignments
-- ---------------------------------------------------------------------
create table public.delivery_assignments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  mode public.delivery_mode not null,
  personnel_id uuid references public.delivery_personnel (id) on delete restrict,
  provider_id uuid references public.delivery_providers (id) on delete restrict,
  external_reference text,
  external_tracking_url text,
  external_rider_name text,
  external_rider_phone text,
  quoted_fee numeric(10, 2),
  status public.assignment_status not null default 'assigned',
  is_current boolean not null default true,
  assigned_by uuid references auth.users (id),
  assigned_at timestamptz not null default now(),
  picked_up_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_assignments_target check (
    (mode = 'own' and personnel_id is not null and provider_id is null) or
    (mode = 'third_party' and provider_id is not null and personnel_id is null)
  )
);
create unique index delivery_assignments_one_current on public.delivery_assignments (order_id) where is_current;
create index delivery_assignments_personnel_idx on public.delivery_assignments (personnel_id, is_current);

-- ---------------------------------------------------------------------
-- 18. delivery_events (status trail incl. provider webhooks)
-- ---------------------------------------------------------------------
create table public.delivery_events (
  id bigint generated always as identity primary key,
  assignment_id uuid references public.delivery_assignments (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  source text not null check (source in ('admin', 'rider', 'provider_webhook', 'system')),
  event_type text not null,
  external_event_id text,
  payload jsonb,
  actor_id uuid references auth.users (id),
  created_at timestamptz not null default now()
);
create index delivery_events_order_idx on public.delivery_events (order_id, created_at);
create unique index delivery_events_external_dedupe on public.delivery_events (assignment_id, external_event_id) where external_event_id is not null;

-- ---------------------------------------------------------------------
-- 23. notifications (history for every channel)
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  channel public.notification_channel not null,
  event_type text not null,
  title text not null,
  body text not null,
  status public.notification_status not null default 'pending',
  provider_message_id text,
  error text,
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_pending_idx on public.notifications (status, channel) where status = 'pending';

-- ---------------------------------------------------------------------
-- 24. reviews (only for completed orders; admin-moderated)
-- ---------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 1000),
  display_name text check (char_length(display_name) <= 60),
  is_approved boolean not null default false,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_public_idx on public.reviews (is_approved, is_featured, created_at desc);

-- ---------------------------------------------------------------------
-- 25. audit_logs
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  details jsonb,
  ip text,
  created_at timestamptz not null default now()
);
create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ---------------------------------------------------------------------
-- Contact form submissions & rate limiting (supporting tables)
-- ---------------------------------------------------------------------
create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  email citext not null,
  phone text,
  message text not null check (char_length(message) between 5 and 2000),
  is_resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits int not null default 0,
  primary key (key, window_start)
);

-- ---------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','customer_addresses','menu_categories','menu_items','carts','cart_items',
    'restaurant_settings','operating_hours','serviceable_areas','pickup_slots','coupons',
    'delivery_personnel','delivery_providers','orders','payments','delivery_assignments','reviews'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', t || '_updated_at', t);
  end loop;
end $$;
