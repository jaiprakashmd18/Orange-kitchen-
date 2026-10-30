# Production launch checklist

## Content (from Orange Kitchen)
- [ ] Official logo uploaded; app icons regenerated from it (`npm run icons -- logo.png`)
- [ ] Every dish has a price, veg/non-veg flag, description and photo, and is published
- [ ] Opening hours, holidays, delivery pincodes/fees/ETAs, pickup slots configured
- [ ] Tax rate and whether prices include tax confirmed with the accountant; GSTIN and FSSAI added
- [ ] WhatsApp, email, Google Maps link/embed, social links added
- [ ] Cancellation and refund policies reviewed; "Our story" and restaurant photos added

## Infrastructure
- [ ] Supabase on a paid plan with daily backups / PITR; custom SMTP configured; email confirmation ON
- [ ] All migrations applied; `public-media` bucket and realtime publication present
- [ ] Vercel production env vars set; `NEXT_PUBLIC_SITE_URL` = live domain; HTTPS on the custom domain
- [ ] Supabase Auth Site URL and redirect URLs use the live domain
- [ ] `CRON_SECRET` set and the cron runs (or an external scheduler is configured)
- [ ] Error monitoring (e.g. Vercel logs/alerts) watched; service-role key rotated if it was ever shared

## Payments
- [ ] Razorpay KYC approved; live keys set; live webhook created with a new secret; all six events subscribed
- [ ] One real low-value order paid and refunded end to end in live mode
- [ ] Settlement bank account verified in Razorpay

## Operations
- [ ] Admin and staff accounts created; owner is an admin; test accounts removed
- [ ] Riders created and trained on `/delivery`; kitchen trained on `/admin/orders`
- [ ] Third-party partners added (manual, or API with credentials tested)
- [ ] Email / WhatsApp notifications tested on real devices (or confirmed intentionally off)
- [ ] Test orders deleted or cancelled; coupons reviewed
- [ ] **Admin → Settings → Accepting online orders** switched ON
- [ ] Google Business Profile links to the site; sitemap submitted in Google Search Console
