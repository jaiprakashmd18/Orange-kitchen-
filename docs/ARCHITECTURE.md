# Architecture

## 1. System overview
```
 Browser / PWA (customers, staff, riders)
   │  HTTPS
   ▼
 Next.js on Vercel (region bom1, Mumbai)
   ├─ Server Components  — read data with the user's Supabase session (RLS applies)
   ├─ Server Actions     — admin/account mutations; every action re-checks the role server-side
   ├─ Route Handlers     — /api/cart, /api/checkout/quote, /api/orders, /api/payments/*,
   │                       /api/webhooks/razorpay, /api/webhooks/delivery/[provider], /api/cron/*
   └─ middleware.ts      — refreshes the auth cookie; redirects anonymous users from protected areas
   │
   ├──► Supabase Postgres (RLS on every table, order state machine in SQL)
   ├──► Supabase Auth (email+password, email verification, reset, optional phone OTP)
   ├──► Supabase Storage (public-media bucket; staff-only uploads)
   ├──► Supabase Realtime (orders, status history, notifications, assignments)
   ├──► Razorpay (orders, payment fetch/capture, refunds; webhooks back to us)
   ├──► Resend (email) / WhatsApp Cloud API (template messages) — optional
   └──► Third-party delivery partner APIs (adapter framework) — optional
```

### Trust boundaries
- The browser never decides prices, totals, order status or payment status.
- **Pricing**: `src/lib/pricing.ts` computes totals in integer paise from database prices. It covers
  options, coupons, packaging, tax (inclusive or exclusive), delivery fee by pincode, and free-delivery thresholds.
- **Orders** are created by `create_order_with_items()` in a single transaction. It checks pickup-slot
  capacity under a row lock. Creation is idempotent per `(customer_id, idempotency_key)`.
- **Payments**: the server verifies the checkout handler's HMAC signature **and** re-fetches the payment
  from Razorpay. It checks the order id, amount and currency, and captures the payment if it is only
  authorised. Only then does `confirm_payment()` run, and it is idempotent. Webhooks are HMAC-verified
  on the raw body, deduplicated by event id, and run the same confirmation. If the browser callback
  is lost, the webhook still confirms the order.
- **Status changes** go only through `transition_order_status()`. It enforces the allowed transitions
  for each fulfilment type and writes history, which drives tracking and in-app notifications.
- **Service-role key** is used only in server code, after the caller's identity and role have been checked.

## 2. Order lifecycle
```
pending_payment ─► payment_confirmed ─► accepted ─► preparing ─► ready ─┬─► delivery_assigned ─► picked_up ─► out_for_delivery ─► delivered
   │   ▲               │                   │            │           │   └─► collected (takeaway)
   ▼   │               └─► rejected        └─► cancelled (refund)   └─► cancelled
payment_failed ─► expired (payment window elapsed; upkeep runs on admin/order page views + daily cron)
```
- Customers can cancel only while the order is `payment_confirmed` (before the restaurant accepts it). This triggers an automatic full refund.
- If staff reject or cancel an order, a full refund is issued automatically. Admin has a retry button if the Razorpay refund fails.
- A rider can be assigned before the food is ready. When the kitchen marks it ready, the order moves straight to `delivery_assigned`.

## 3. Folder structure
```
supabase/migrations/      0100 schema · 0200 functions/state machine · 0300 RLS/storage/realtime · 0400 seed
scripts/                  test-migrations.sh (local Postgres + Supabase stubs), generate-icons.mjs
tests/                    *.test.ts unit tests; db/*.sql database tests
public/                   sw.js (service worker), offline.html, icons/
src/middleware.ts         session refresh + protected-route redirects
src/app/
  layout.tsx              fonts, metadata, cart provider, service-worker registration
  (site)/                 public + customer pages (header/footer, Restaurant JSON-LD)
    page.tsx, menu/, about/, contact/, policies/, cart/, checkout/, orders/[id]/(receipt),
    auth/(login|signup|forgot-password|reset-password|callback|signout), account/*
  admin/                  admin & staff dashboard: orders, menu, categories, settings, hours,
                          delivery-areas, pickup-slots, coupons, delivery-team, delivery-providers,
                          reports, reviews, messages, staff, audit
  delivery/               rider app: assigned, order detail, history
  api/                    route handlers (see §1)
  manifest.ts robots.ts sitemap.ts not-found.tsx error.tsx
src/components/           ui/, site/, menu/, cart/, checkout/, orders/, account/, admin/, auth/, home/
src/lib/
  supabase/               server (user session), admin (service role), client, middleware
  pricing.ts schedule.ts  pure, unit-tested business rules
  orders.ts payments.ts   quotes, order placement, transitions, refunds, payment settlement
  razorpay.ts             REST client + signature verification
  notifications/          email / WhatsApp dispatch with history
  delivery/providers.ts   third-party delivery adapter framework
  auth.ts admin-action.ts role guards; audited admin server-action wrapper
  data.ts menu-view.ts reports.ts order-queries.ts …  read models
```

## 4. Database design
Every table has a UUID or identity primary key, foreign keys, CHECK constraints, `created_at` and
`updated_at` (set by trigger), and indexes on its access paths. RLS is enabled and forced on all of them.

| # | Table | Purpose / key rules |
|---|---|---|
| 1 | profiles | 1:1 with auth.users (created by trigger); favourites, WhatsApp opt-in. Email is not client-writable |
| 2 | customer_addresses | owner-only; one default per user (partial unique index + trigger); pincode and phone validated |
| 3 | user_roles | `admin` / `staff` / `delivery`; customers have no row; only admins write |
| 4 | menu_categories | two levels (parent_id); public read when active |
| 5 | menu_items | price is NULL until entered; **cannot be published without a price and veg flag**; options JSON; specials window |
| 6 | menu_item_availability | weekday time windows per dish (none = always available) |
| 7–8 | carts, cart_items | server cart per customer; owner-only |
| 9 | orders | money and address snapshots, pickup slot, ETAs, payment deadline; unique idempotency key; takeaway can't carry a delivery fee |
| – | order_status_history | every transition with its actor; drives the tracking timeline and notifications |
| 10 | order_items | snapshot of name, price and options |
| 11 | payments | Razorpay order/payment ids (unique), status, method, refunds; **no card data** |
| 12 | payment_webhook_events | verified events, unique `(provider, event_id)` for dedupe; forged calls are logged under random ids |
| 13–14 | coupons, coupon_redemptions | % or flat, caps, minimum order, validity window, total and per-user limits, delivery/takeaway scope |
| 15 | delivery_personnel | rider profile linked to a login |
| 16 | delivery_assignments | own rider XOR third-party provider; one *current* assignment per order |
| 17 | delivery_providers | adapter + env-var prefix (secrets are never stored in the DB) |
| 18 | delivery_events | admin / rider / provider-webhook trail; deduped by external event id |
| 19 | restaurant_settings | singleton row: contact, address, maps, socials, ordering switches, tax, fees, policies |
| 20 | operating_hours (+ holiday_closures) | several windows per day; dated closures |
| 21 | serviceable_areas | pincode → fee, free-delivery threshold, minimum order, ETA |
| 22 | pickup_slots | weekly slot templates with capacity |
| 23 | notifications | in-app / email / WhatsApp history with status (sent / failed / skipped) |
| 24 | reviews | only for the customer's own delivered or collected order; moderated |
| 25 | audit_logs | admin actions, payment events, exports |
| – | contact_messages, rate_limits | contact form; Postgres-backed rate limiter |

### RLS summary
- Customers see their own profile, addresses, cart, orders (with items, history and payments) and notifications.
- Riders see only orders whose *current* assignment is theirs. The `is_assigned_rider()` definer helper avoids policy recursion.
- Staff can read orders, the menu, reviews, messages and the delivery team. Admins can do everything, including settings, coupons, roles and the audit log.
- **No client role can write** orders, payments or webhook events. Functions that mutate them are executable only by `service_role`.
- Storage bucket `public-media`: public read, staff-only write.

## 5. Security controls
- Supabase Auth, with sessions validated on the server (`getUser`).
- Role checks in middleware, in layouts **and** in every server action and route.
- RLS on every table; zod input validation.
- Prices computed in integer paise.
- Idempotent order creation and payment confirmation.
- Timing-safe HMAC verification for checkout and webhooks; webhook deduplication.
- Rate limiting on orders, quotes, payment verification and the contact form; honeypot field on the contact form.
- Open-redirect guard on `next=`; CSV formula-injection escaping.
- Security headers: HSTS, nosniff, frame options, referrer policy, permissions policy.
- Audit log of admin actions, payment events and exports.
- Secrets live only in environment variables.
- The service worker never caches API, auth or order pages.
