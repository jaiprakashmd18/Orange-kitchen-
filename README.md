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

## Go live: add keys, deploy
1. Create a **Supabase** project and a **Razorpay** account (test mode).
2. Import this repo in **Vercel** and paste the keys listed in [`.env.example`](.env.example) (Supabase URL / anon / service role / DB URL / access token, `ADMIN_EMAIL` + `ADMIN_PASSWORD`, Razorpay key id + secret).
3. **Deploy.** The build automatically migrates the database, creates your admin login, configures Supabase Auth and verifies the Razorpay keys.
4. Log in at `/admin`, upload the logo, import the menu CSV with prices, set hours, delivery areas and slots, and switch **Accepting online orders** on.

Step-by-step guide: [docs/SETUP.md](docs/SETUP.md). If a key is missing, `/setup` on the site tells you which.

Local: `npm install && cp .env.example .env.local && npm run setup && npm run dev`.

## Scripts
| Command | What it does |
|---|---|
| `npm run setup` | Migrate DB, create admin, configure Auth, check keys (also runs automatically in `build`) |
| `npm run dev` / `build` / `start` | Next.js (`build` runs setup first) |
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
| Razorpay payments, refunds | Implemented — needs your keys (use test mode first). Webhook optional: payments and refunds are auto-reconciled with Razorpay |
| Database, admin account, Auth config | Automatic on deploy from env vars |
| Menu bulk import / export | Admin → Dishes → Import CSV |
| Email notifications | Implemented — **not active until `RESEND_API_KEY` and `EMAIL_FROM` are set** |
| WhatsApp notifications | Implemented — **not active until WhatsApp Cloud API credentials and an approved template are set** |
| Phone OTP login | UI implemented — **requires an SMS provider enabled in Supabase Auth** |
| Third-party delivery APIs | Adapter framework + manual tracking implemented — **no partner API is active until credentials are configured** |
| Live GPS rider tracking | **Not implemented** (no location is collected); riders get a Google Maps navigation link |

## Content still needed from Orange Kitchen
None of this has been invented. Enter it in the admin dashboard:
- **Official logo** (Admin → Settings → Logo), then `npm run icons -- logo.png` for the app icons. Until then the site shows a text wordmark and a neutral placeholder icon.
- **Menu prices, descriptions, photos and veg/non-veg flags.** The sections and dishes you named are seeded as categories and *unpublished drafts*. A dish can't be published without a price. The fastest route is a spreadsheet uploaded through **Admin → Dishes → Import CSV**.
- Opening hours, holidays, delivery pincodes and fees, pickup slots, tax rate, packaging charge, minimum order.
- WhatsApp number, email, Google Maps link, social links, GSTIN/FSSAI, "Our story" text, restaurant photos.
- Review the seeded cancellation and refund policy text.
