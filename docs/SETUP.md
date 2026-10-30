# Setup: add your keys, deploy

Everything is automated. You create three accounts, copy keys into Vercel, and deploy.
On every build, `scripts/setup.mjs` runs before `next build`. It:
1. applies the database migrations (tracked and idempotent; safe to run on every deploy),
2. creates the admin login from `ADMIN_EMAIL` / `ADMIN_PASSWORD`,
3. configures Supabase Auth (site URL, redirect URLs, email confirmation, optional SMTP) when `SUPABASE_ACCESS_TOKEN` is set,
4. checks your Razorpay keys and prints a status report in the build log.

## Step 1 — Supabase (≈5 min)
1. Go to [supabase.com](https://supabase.com) → **New project**. Region: **Mumbai (ap-south-1)**. Save the database password.
2. **Project Settings → API**: copy the Project URL, the `anon` key and the `service_role` key.
3. **Connect** (top bar) → **Session pooler** → copy the URI and put your DB password in it. This is `SUPABASE_DB_URL`.
4. Create an access token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens). This is `SUPABASE_ACCESS_TOKEN`.

> Shortcut: in Vercel, add the official **Supabase integration** to the project. It fills in the URL, both keys and
> `POSTGRES_URL` for you. You then only add `SUPABASE_ACCESS_TOKEN`, the admin and the Razorpay keys.

## Step 2 — Razorpay (≈5 min)
1. [dashboard.razorpay.com](https://dashboard.razorpay.com) → switch to **Test mode** → **Account & Settings → API Keys** → Generate.
2. Copy the Key ID (`rzp_test_…`) and the Key Secret.
3. *(Optional, recommended)* **Webhooks → Add**: URL `https://<your-site>/api/webhooks/razorpay`, choose a secret, and tick
   `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
   Without the webhook, payments are still confirmed by the signature check plus automatic reconciliation with Razorpay.

## Step 3 — Deploy on Vercel (≈3 min)
1. [vercel.com/new](https://vercel.com/new) → import this GitHub repository (framework: Next.js, no settings to change).
2. Before deploying, open **Environment Variables** and add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `SUPABASE_DB_URL` | Session pooler URI |
| `SUPABASE_ACCESS_TOKEN` | access token |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | owner login (password ≥ 10 characters) |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay keys |
| `RAZORPAY_WEBHOOK_SECRET` | *(optional)* webhook secret |

3. **Deploy**. The build log shows the setup report (✓ / !).
4. Open `https://<your-site>/admin` and log in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.
5. **Custom domain**: add it in Vercel → Domains, set `NEXT_PUBLIC_SITE_URL=https://yourdomain.in`, and redeploy. Setup then updates Supabase Auth for the new domain. If you use the webhook, update its URL in Razorpay too.

If anything is missing, visiting `/setup` on the site lists exactly which variables still need to be added.

## Step 4 — Restaurant details (in the admin, no code)
The **Dashboard → Launch checklist** links to each item:
1. **Settings**: upload the logo; add WhatsApp, email, Google Maps link, socials, tax %, packaging charge, minimum order, policies.
2. **Hours & holidays**.
3. **Delivery areas**: pincodes, fees, free-delivery threshold, ETA.
4. **Pickup slots** → *Generate from opening hours* (one click).
5. **Dishes → Import CSV**: upload your menu sheet (category, subcategory, name, price, veg, …). Or edit dishes one by one and upload photos.
6. **Delivery team**: add riders. Each one gets a login for `/delivery`.
7. **Settings → Accepting online orders: ON**.

Then place a test order using Razorpay test UPI `success@razorpay`. When everything passes ([TESTING.md](TESTING.md)),
swap in the `rzp_live_` keys and redeploy ([LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md)).

## Optional integrations (just add keys and redeploy)
- **Email order updates**: Resend account + verified domain → `RESEND_API_KEY`, `EMAIL_FROM`.
- **Login/verification emails from your own domain**: `SMTP_*` variables (applied automatically). Strongly recommended for launch, because Supabase's built-in sender only allows a few emails per hour.
- **WhatsApp order updates**: Meta WhatsApp Cloud API → `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_ORDER_TEMPLATE` (an approved utility template with `{{1}}` order no., `{{2}}` status, `{{3}}` link).
- **Mobile OTP login**: Supabase → Authentication → Providers → Phone → choose an SMS provider (Twilio / MessageBird / Vonage).
- **Delivery partner API**: see [DELIVERY_PROVIDERS.md](DELIVERY_PROVIDERS.md).
- **`CRON_SECRET`**: protects the 10-minute upkeep job. Without it the job still runs (throttled), and upkeep also runs whenever the admin dashboard is open.

## Running locally
```bash
npm install
cp .env.example .env.local   # fill in the same keys
npm run setup                # migrate + admin + checks
npm run dev                  # http://localhost:3000
```

## Backups
Supabase Pro includes daily backups; enable Point-in-Time Recovery for production. Admin → Reports can export orders, payments and the menu as CSV at any time.
