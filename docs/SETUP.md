# Installation, setup & deployment

## 1. Prerequisites
Node.js 20+, a Supabase project (region: Mumbai `ap-south-1`), a Razorpay account, a Vercel account.

## 2. Install
```bash
npm install
cp .env.example .env.local
```

## 3. Supabase
1. Create a project, then copy the **Project URL**, **anon key** and **service_role key** into `.env.local`.
2. Apply the migrations in order. Use either:
   - **SQL Editor**: run each file in `supabase/migrations/` from oldest to newest, or
   - **CLI**: `npx supabase link --project-ref <ref>` then `npx supabase db push`.
3. **Auth → Providers → Email**: enable it and keep **Confirm email** ON. The app refuses to place orders for unverified accounts.
4. **Auth → URL Configuration**: set the Site URL to your domain, and add `https://<domain>/auth/callback` and `http://localhost:3000/auth/callback` as redirect URLs.
5. **Auth → SMTP**: configure a real SMTP sender for production; Supabase's default sender is heavily rate-limited.
6. (Optional) **Auth → Providers → Phone**: enable an SMS provider (e.g. Twilio or MessageBird) to activate mobile OTP login.
7. Check that the migration created the **Storage** bucket `public-media`.
8. Check that **Realtime** is enabled for `orders`, `order_status_history`, `notifications` and `delivery_assignments` (the migration adds them to `supabase_realtime`).
9. **Backups**: on a paid plan, enable daily backups or Point-in-Time Recovery. You can also schedule `pg_dump` of the database to off-site storage.

## 4. Create the first admin account
1. Sign up on the site with the owner's email and verify it.
2. In the Supabase SQL Editor run:
```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'owner@example.com'
on conflict do nothing;
```
3. Log in and open `/admin`. Further admins and staff can be added from **Admin → Staff access**. Riders are added from **Admin → Delivery team**, which creates their login.

## 5. Razorpay
1. **Dashboard → Account & Settings → API Keys**: generate **Test** keys and set `NEXT_PUBLIC_RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
2. **Webhooks → Add**: URL `https://<domain>/api/webhooks/razorpay`, with a strong secret (set the same value in `RAZORPAY_WEBHOOK_SECRET`). Subscribe to the events:
   `payment.authorized`, `payment.captured`, `payment.failed`, `order.paid`, `refund.processed`, `refund.failed`.
3. Payment methods: enable UPI, cards, net banking and wallets as required. Cash on delivery is not offered by the app.
4. Optionally enable **automatic capture**. If it's off, the server captures authorised payments itself after verifying them.
5. Test with Razorpay's test cards and UPI ids (`success@razorpay` / `failure@razorpay`).
6. **Going live**: only after KYC/merchant verification and the full test checklist pass. Swap in the `rzp_live_` keys, create a live-mode webhook with a new secret, and redeploy. The admin settings page shows which mode is active.

## 6. Notifications (optional)
- **Email**: create a Resend account, verify your sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM`.
- **WhatsApp**: in Meta Business Manager, create a WhatsApp Cloud API app and get a permanent token and phone-number id. Get a *utility* template approved with three body variables: `{{1}}` order number, `{{2}}` status, `{{3}}` tracking link. Then set the `WHATSAPP_*` variables. Messages are sent only to customers who opt in from their account settings.
- If a channel isn't configured, its attempts are recorded as `skipped`, so the notification history stays accurate.

## 7. Deploy to Vercel
1. Push the repository to GitHub and import it in Vercel (framework: Next.js).
2. Add every variable from `.env.example` under Project → Settings → Environment Variables. Set `NEXT_PUBLIC_SITE_URL` to the production URL.
3. Set `CRON_SECRET` to a long random string. `vercel.json` schedules `/api/cron/expire-orders` every 10 minutes; Vercel sends the secret automatically. On the Hobby plan crons run at most daily; use Pro, or call the endpoint from an external scheduler with the `Authorization: Bearer` header.
4. Add the custom domain, then update the Supabase Auth URLs and the Razorpay webhook URL to use it.
5. Run `npm run icons -- path/to/official-logo.png`, commit the icons, and redeploy.

## 8. Restaurant configuration (Admin)
Settings (contact, WhatsApp, email, Maps, socials, logo, tax, packaging, minimum order, policies) → Hours & holidays → Delivery areas → Pickup slots → Dishes (prices, photos, veg flags, publish) → Delivery team → turn on **Accepting online orders**.
