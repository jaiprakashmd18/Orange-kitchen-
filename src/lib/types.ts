// Row types mirroring supabase/migrations. Keep in sync with the schema.

export type AppRole = "admin" | "staff" | "delivery";
export type Fulfillment = "delivery" | "takeaway";
export type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "expired"
  | "payment_confirmed"
  | "accepted"
  | "preparing"
  | "ready"
  | "delivery_assigned"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "collected"
  | "rejected"
  | "cancelled";
export type PaymentStatus =
  | "created"
  | "authorized"
  | "captured"
  | "failed"
  | "refund_pending"
  | "refunded"
  | "partially_refunded"
  | "verification_pending";
export type PaymentMethod = "razorpay" | "upi";
export type DeliveryMode = "own" | "third_party";

export interface OptionChoice {
  id: string;
  label: string;
  price_delta: number;
}
export interface OptionGroup {
  id: string;
  name: string;
  required: boolean;
  max: number;
  choices: OptionChoice[];
}
/** groupId -> selected choice ids */
export type SelectedOptions = Record<string, string[]>;

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  image_source?: "upload" | "pexels" | "wikimedia" | "pixabay";
  image_credit?: string | null;
  image_credit_url?: string | null;
  is_veg: boolean | null;
  is_published: boolean;
  is_available: boolean;
  is_popular: boolean;
  is_special: boolean;
  special_from: string | null;
  special_until: string | null;
  options: OptionGroup[];
  max_per_order: number;
  sort_order: number;
}

export interface AvailabilityWindow {
  id: string;
  menu_item_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface RestaurantSettings {
  id: 1;
  name: string;
  tagline: string;
  logo_url: string | null;
  announcement: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  google_maps_url: string | null;
  google_maps_embed_url: string | null;
  social_links: Record<string, string>;
  currency: string;
  timezone: string;
  accepting_orders: boolean;
  delivery_enabled: boolean;
  takeaway_enabled: boolean;
  delivery_mode_default: DeliveryMode;
  min_order_amount: number;
  tax_rate_percent: number;
  tax_label: string;
  prices_include_tax: boolean;
  packaging_charge: number;
  prep_time_minutes: number;
  payment_window_minutes: number;
  upi_enabled: boolean;
  auto_dish_photos: boolean;
  upi_id: string | null;
  upi_payee_name: string | null;
  pickup_instructions: string | null;
  about_story: string | null;
  gallery_urls: string[];
  cancellation_policy: string | null;
  refund_policy: string | null;
  gstin: string | null;
  fssai_license: string | null;
}

export interface OperatingHour {
  id: string;
  day_of_week: number;
  open_time: string;
  close_time: string;
  label: string | null;
}

export interface HolidayClosure {
  id: string;
  closed_on: string;
  reason: string | null;
}

export interface ServiceableArea {
  id: string;
  name: string;
  pincode: string;
  delivery_fee: number;
  free_delivery_above: number | null;
  min_order_amount: number;
  estimated_minutes: number;
  is_active: boolean;
}

export interface PickupSlot {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_orders: number;
  is_active: boolean;
}

export interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "flat";
  discount_value: number;
  max_discount: number | null;
  min_order_amount: number;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit: number | null;
  per_user_limit: number;
  applies_to: Fulfillment | null;
  is_active: boolean;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  house: string;
  street: string;
  area: string;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  delivery_instructions: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_default: boolean;
}

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  marketing_opt_in: boolean;
  whatsapp_opt_in: boolean;
  favourite_item_ids: string[];
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  menu_item_id: string | null;
  item_name: string;
  is_veg: boolean;
  unit_price: number;
  quantity: number;
  selected_options: { group: string; choice: string; price_delta: number }[];
  line_total: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  fulfillment: Fulfillment;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  delivery_fee: number;
  packaging_charge: number;
  tax_amount: number;
  total_amount: number;
  coupon_code: string | null;
  special_instructions: string | null;
  delivery_address: (Omit<Address, "id" | "user_id" | "is_default" | "label"> & { label?: string }) | null;
  delivery_mode: DeliveryMode | null;
  pickup_slot_id: string | null;
  pickup_date: string | null;
  pickup_time: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  estimated_ready_at: string | null;
  estimated_delivery_at: string | null;
  payment_due_at: string;
  paid_at: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  provider: "razorpay" | "upi";
  submitted_at: string | null;
  provider_order_id: string;
  provider_payment_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  failure_reason: string | null;
  refund_id: string | null;
  refunded_amount: number;
  refunded_at: string | null;
  captured_at: string | null;
  created_at: string;
}

export interface StatusHistory {
  id: number;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_role: string | null;
  note: string | null;
  created_at: string;
}

export interface DeliveryPersonnel {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  vehicle_number: string | null;
  is_active: boolean;
  is_on_duty: boolean;
}

export interface DeliveryProvider {
  id: string;
  name: string;
  code: string;
  adapter: "manual" | "http_generic";
  env_prefix: string | null;
  api_base_url: string | null;
  tracking_url_template: string | null;
  contact_phone: string | null;
  is_active: boolean;
  notes: string | null;
}

export interface DeliveryAssignment {
  id: string;
  order_id: string;
  mode: DeliveryMode;
  personnel_id: string | null;
  provider_id: string | null;
  external_reference: string | null;
  external_tracking_url: string | null;
  external_rider_name: string | null;
  external_rider_phone: string | null;
  quoted_fee: number | null;
  status: string;
  is_current: boolean;
  assigned_at: string;
  picked_up_at: string | null;
  delivered_at: string | null;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  order_id: string | null;
  channel: "in_app" | "email" | "whatsapp";
  event_type: string;
  title: string;
  body: string;
  status: string;
  read_at: string | null;
  created_at: string;
}

export interface Review {
  id: string;
  order_id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  display_name: string | null;
  is_approved: boolean;
  is_featured: boolean;
  created_at: string;
}
