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
3. Create an access token at [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens). This is `SUPABASE_ACCESS_TOKEN`. The build uses it to create the database tables, so no SQL or connection string is needed.
4. *(Optional alternative)* **Connect** (top bar) → **Session pooler** → copy the URI with your DB password filled in. This is `SUPABASE_DB_URL`.

> Shortcut: in Vercel, add the official **Supabase integration** to the project. It fills in the URL, both keys and
> `POSTGRES_URL` for you. You then only add `SUPABASE_ACCESS_TOKEN`, the admin and the Razorpay keys.

## Step 2 — Payments

### Option A — UPI straight to your UPI ID (GPay, PhonePe, Paytm). No keys needed.
1. Admin → **Settings** → *UPI payments* → tick **Accept UPI payments**, enter your UPI ID (e.g. `orangekitchen@okaxis`) and the name to show → **Save**.
2. Customers choose **UPI** at checkout. They pay by scanning the QR code or tapping **Pay with Google Pay**, then enter the 12-digit **UPI transaction ID**.
3. You get a **"UPI payments waiting for you to verify"** alert on the dashboard. Open the order, check your GPay/bank app for that amount and transaction ID, and click **Payment received** (or **Not received**). Only then does the order go to the kitchen.
4. Refunds for UPI orders are sent from your UPI app, then recorded with **Mark refunded** on the order.

> Use a **GPay for Business / merchant UPI ID** if you can. Personal UPI IDs can hit daily collection limits, and some apps warn
> customers when they pay a personal ID. UPI has no public API to confirm payments to a plain UPI ID, so this check is done
> by a person. Choose Option B if you want fully automatic confirmation.

### Option B — Razorpay (automatic confirmation; cards, UPI incl. GPay, net banking) (≈5 min)
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
| `SUPABASE_ACCESS_TOKEN` | access token |
| `SUPABASE_DB_URL` | *(optional)* Session pooler URI |
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

## Emails from your Gmail (recommended before launch)
Supabase's built-in email sender is limited to a few emails per hour. That's fine for testing, but too few for real customers signing up.
Using Gmail fixes this, and the same account also sends order update emails:
1. Turn on **2-Step Verification** for the Gmail account (myaccount.google.com → Security).
2. Open **myaccount.google.com/apppasswords**, create an app password named "Orange Kitchen", and copy the 16 letters (without spaces).
3. In Vercel, add:
   `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER=you@gmail.com`, `SMTP_PASS=<app password>`,
   `SMTP_SENDER_EMAIL=you@gmail.com`, `SMTP_SENDER_NAME=Orange Kitchen`. `SUPABASE_ACCESS_TOKEN` must also be set.
4. **Redeploy.** The build log shows `✓ custom SMTP smtp.gmail.com` and `order email notifications on via SMTP`.

Gmail allows about 500 emails a day. If you outgrow that, switch to a domain email or Resend.

## Optional integrations (just add keys and redeploy)
- **Email order updates**: Resend account + verified domain → `RESEND_API_KEY`, `EMAIL_FROM`.
- **Login/verification emails from your own domain**: `SMTP_*` variables (applied automatically). Strongly recommended for launch, because Supabase's built-in sender only allows a few emails per hour.
- **WhatsApp order updates**: Meta WhatsApp Cloud API → `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, and `WHATSAPP_ORDER_TEMPLATE` (an approved utility template with `{{1}}` order no., `{{2}}` status, `{{3}}` link).
- **Mobile OTP login**: Supabase → Authentication → Providers → Phone → choose an SMS provider (Twilio / MessageBird / Vonage).
- **Delivery partner API**: see [DELIVERY_PROVIDERS.md](DELIVERY_PROVIDERS.md).
- **`CRON_SECRET`**: protects the daily upkeep job (`vercel.json` schedules it once a day so it works on the free Hobby plan; on Pro you can change it to every 10 minutes). Upkeep also runs, throttled, whenever the admin dashboard or an unpaid order page is open.

## Running locally
```bash
npm install
cp .env.example .env.local   # fill in the same keys
npm run setup                # migrate + admin + checks
npm run dev                  # http://localhost:3000
```

## Backups
Supabase Pro includes daily backups; enable Point-in-Time Recovery for production. Admin → Reports can export orders, payments and the menu as CSV at any time.

## Can't log in to /admin?
1. Use **exactly** the `ADMIN_EMAIL` and `ADMIN_PASSWORD` you set in Vercel. If the account is missing, unconfirmed or lacks admin rights, logging in with these values creates or repairs it automatically.
2. Changed those variables? **Redeploy** first, because Vercel only applies new variables to new deployments.
3. Seeing "database is not set up"? Add `SUPABASE_ACCESS_TOKEN` and redeploy.
4. Being sent to `/setup`? Some Supabase keys are missing. The page lists which ones.

## Troubleshooting a failed deployment
- **Open the log**: Vercel → your project → Deployments → the failed one → **Build Logs**. The "Orange Kitchen setup" report is at the top.
- **"Hobby accounts are limited to daily cron jobs"**: already handled — `vercel.json` uses a daily schedule.
- **Two projects deploying** (e.g. `orange-kitchen` and `orange-kitchen-c697`): the repo was imported twice. Keep the one with your environment variables and delete the other (Settings → Advanced → Delete Project).
- **Database step shows ✗ / site shows "database is not set up"**: use the *Session pooler* connection string (not "Direct connection") with the real password, then redeploy. Set `SETUP_STRICT=1` if you prefer database problems to fail the build.
