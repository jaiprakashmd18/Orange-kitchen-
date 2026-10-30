# Orange Kitchen — Restaurant Website & Online Ordering Platform

**Freshly Prepared. Deliciously Served.**
Shop 32, Pillaiyar Koil Street, Surapet Service Road, Chennai – 600066 · +91 80722 72313

A production-grade restaurant commerce platform: public website, customer accounts, cart & checkout,
Razorpay online payments (no cash on delivery), home delivery and takeaway, own-rider and third-party
delivery management, live order tracking, notifications, admin dashboard, reports and an installable PWA.

| Area | Path |
|---|---|
| Public site | `/`, `/menu`, `/about`, `/contact`, `/policies` |
| Customer | `/auth/*`, `/cart`, `/checkout`, `/orders/[id]`, `/account/*` |
| Admin / staff | `/admin/*` |
| Delivery riders | `/delivery/*` |

## Stack
Next.js 15 (App Router, TypeScript) · Tailwind CSS · Framer Motion · Supabase (Postgres, Auth, Storage,
Realtime, RLS) · Razorpay · Resend (email, optional) · WhatsApp Cloud API (optional) · Vercel.

## Quick start (local)
```bash
npm install
cp .env.example .env.local          # fill in Supabase + Razorpay TEST keys
# apply supabase/migrations/*.sql to your Supabase project (see docs/SETUP.md)
npm run dev                         # http://localhost:3000
```

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` / `lint` | TypeScript & ESLint |
| `npm test` | Unit tests (pricing engine, coupons, opening hours, pickup slots) |
| `npm run db:test` | Applies all migrations to a throwaway local Postgres and runs SQL tests for the order state machine, payment idempotency, atomic order creation and RLS isolation |
| `npm run icons -- path/to/logo.png` | Generates PWA/app icons from the official logo |

## Documentation
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture, folder structure, database design, security model
- [docs/SETUP.md](docs/SETUP.md) — installation, Supabase, Razorpay, notifications, admin account, deployment
- [docs/DELIVERY_PROVIDERS.md](docs/DELIVERY_PROVIDERS.md) — third-party delivery integration contract
- [docs/TESTING.md](docs/TESTING.md) — testing checklist
- [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md) — production launch checklist

## Feature status
| Feature | Status |
|---|---|
| Website, menu, cart, checkout, accounts, admin, rider app, reports, PWA, SEO | Implemented |
| Razorpay payments, webhooks, refunds | Implemented — needs your keys (use test mode first) |
| Email notifications | Implemented — **not active until `RESEND_API_KEY` and `EMAIL_FROM` are set** |
| WhatsApp notifications | Implemented — **not active until WhatsApp Cloud API credentials and an approved template are set** |
| Phone OTP login | UI implemented — **requires an SMS provider enabled in Supabase Auth** |
| Third-party delivery APIs | Adapter framework + manual tracking implemented — **no partner API is active until credentials are configured** |
| Live GPS rider tracking | **Not implemented** (no location is collected); riders get a Google Maps navigation link |

## Content still needed from Orange Kitchen
None of this has been invented. Enter it in the admin dashboard:
- **Official logo** (Admin → Settings → Logo), then `npm run icons -- logo.png` for the app icons. Until then the site shows a text wordmark and a neutral placeholder icon.
- **Menu prices, descriptions, photos and veg/non-veg flags.** The sections and dishes you named are seeded as categories and *unpublished drafts*. A dish can't be published without a price.
- Opening hours, holidays, delivery pincodes and fees, pickup slots, tax rate, packaging charge, minimum order.
- WhatsApp number, email, Google Maps link, social links, GSTIN/FSSAI, "Our story" text, restaurant photos.
- Review the seeded cancellation and refund policy text.
