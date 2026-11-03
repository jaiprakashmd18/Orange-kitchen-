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
Next.js 16 (App Router, TypeScript) · Tailwind CSS · Framer Motion · Supabase (Postgres, Auth, Storage,
Realtime, RLS) · Razorpay · Resend (email, optional) · WhatsApp Cloud API (optional) · Vercel.

## Easy setup — no code, no env variables to copy
1. **Supabase**: create a free project (region Mumbai).
2. **Vercel**: import this repo → Deploy → Integrations → **Supabase → Connect** → Redeploy.
3. **Open your site**: it shows *Set up your website*. Paste a Supabase access token, choose your owner email and password, and click once. The database and admin login are created for you.
4. **Admin**: Settings (UPI ID for GPay), Integrations (Gmail, Razorpay: paste and test), Dishes → Import CSV, **Go online**.

Full guide: [docs/SETUP.md](docs/SETUP.md). Environment variables still work and take precedence (see [`.env.example`](.env.example)).

## Scripts
| Command | What it does |
|---|---|
| `npm run setup` | Migrate DB, create admin, configure Auth, check keys (also runs automatically in `build`) |
| `npm run dev` / `build` / `start` | Next.js 16 (`build` runs setup first) |
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
| UPI to your own UPI ID (GPay / PhonePe / Paytm) | Implemented — turn on in Admin → Settings → UPI payments. Customer pays via QR / GPay button and submits the 12-digit transaction ID; staff confirm it in Admin → Orders → "UPI to verify". No gateway fees, but **not automatic** (no bank API to confirm it) |
| Razorpay (cards, UPI, net banking), refunds | Optional — automatic confirmation; needs your keys (test mode first). Webhook optional: payments and refunds are auto-reconciled |
| Database, admin account, Auth config | Automatic: `/setup` wizard in the browser (or env vars at build time) |
| Integrations (Gmail, Razorpay, WhatsApp, photo keys) | Admin → Integrations: paste, tested before saving, stored encrypted |
| One-click publishing | Admin → Dishes → "Publish all ready dishes", or inline price + Publish per dish |
| Menu bulk import / export | Admin → Dishes → Import CSV |
| Automatic dish photos | New/imported dishes get a credited, freely licensed food photo (Wikimedia Commons with no key; Pixabay or Pexels optional), labelled "Representative image"; pick alternatives per dish or upload your own |
| Email notifications | Implemented — **not active until Gmail is connected in Admin → Integrations** (or Resend/SMTP env vars) |
| WhatsApp notifications | Implemented — **not active until WhatsApp Cloud API credentials and an approved template are added in Admin → Integrations** |
| Phone OTP login | UI implemented — **requires an SMS provider enabled in Supabase Auth** |
| Third-party delivery APIs | Adapter framework + manual tracking implemented — **no partner API is active until credentials are configured** |
| Live GPS rider tracking | **Not implemented** (no location is collected); riders get a Google Maps navigation link |

## Content still needed from Orange Kitchen
None of this has been invented. Enter it in the admin dashboard:
- ~~Logo~~ ✓ Official logo, mascot, banner and app icons are built in (`public/brand/`). Uploading a different logo in Admin → Settings overrides the header logo.
- ~~Meal periods & WhatsApp~~ ✓ Breakfast, Lunch, Dinner, Tea & Coffee categories and WhatsApp +91 80722 72313 are seeded from the banner.
- **Zomato / Swiggy links** (Admin → Settings → Social media & delivery apps) — the "Order on" buttons appear once added.
- **Menu prices, descriptions, photos and veg/non-veg flags.** The sections and dishes you named are seeded as categories and *unpublished drafts*. A dish can't be published without a price. The fastest route is a spreadsheet uploaded through **Admin → Dishes → Import CSV**.
- Opening hours, holidays, delivery pincodes and fees, pickup slots, tax rate, packaging charge, minimum order.
- Email, Google Maps link, social links, GSTIN/FSSAI, "Our story" text, restaurant photos.
- Review the seeded cancellation and refund policy text.
