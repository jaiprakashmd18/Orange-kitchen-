# Testing checklist

## Automated
- [ ] `npm run typecheck` and `npm run lint` are clean
- [ ] `npm test`: pricing (options, quantities, tax inclusive/exclusive, packaging, free delivery, coupons), opening hours, item windows, pickup slots
- [ ] `npm run db:test`: migrations apply; order numbers; idempotency key; takeaway has no fee; illegal transitions rejected; payment amount mismatch rejected; double confirmation is idempotent; a late failure never downgrades a captured payment; auto-advance to `delivery_assigned`; atomic order creation and rollback; pickup slot capacity; expiry; RLS (customer isolation, no client writes to orders, no role self-escalation, email not editable, rider sees only assigned orders, anon sees only published dishes)
- [ ] `npm run build` succeeds

## Manual — Razorpay test mode
**Customer**
- [ ] Browse home and menu while logged out; add items to the cart; the cart survives a reload
- [ ] Checkout while logged out → redirected to login, then back to checkout
- [ ] Sign up → verification email → callback → account. Forgot/reset password works
- [ ] Cart merges across devices after login
- [ ] Coupon: valid, expired, below minimum, already used, delivery-only on takeaway
- [ ] Delivery: add address; non-serviceable pincode is blocked; fee/free threshold/minimum order; outside hours blocked
- [ ] Takeaway: only future slots with capacity; no delivery fee; full slot rejected
- [ ] Sold-out and unpublished dishes can't be ordered (also try editing the request in devtools — the server rejects it)
- [ ] Pay with `success@razorpay` → order page shows "Payment confirmed" without a refresh
- [ ] Pay with `failure@razorpay` → payment failed → "Complete payment" retry works
- [ ] Close the payment window → order saved, retry before the deadline; after the deadline it shows expired (cron)
- [ ] Double-click Pay → only one order is created
- [ ] Block `/api/payments/verify` in devtools → the webhook still confirms the order
- [ ] Cancel before acceptance → refund initiated → `refund.processed` webhook marks it refunded
- [ ] Receipt downloads/prints; reorder; favourites; notifications; payment history
- [ ] Customer A cannot open customer B's `/orders/<id>` (404)

**Admin / staff**
- [ ] Non-staff are redirected from `/admin`; staff can't see settings/coupons/reports
- [ ] Accept → preparing → ready (takeaway → collected); reject with a reason → customer sees the reason and a refund
- [ ] Assign a rider before ready, mark ready → status becomes delivery assigned; reassign
- [ ] Third-party manual booking with reference and tracking link; API booking is refused while not configured
- [ ] Menu: create a dish, upload a photo, options, availability window, special dates; publishing without a price is blocked
- [ ] Settings, hours, holidays, areas, slots, coupons all save and take effect on the site
- [ ] Reports match the orders; CSV exports open correctly in Excel
- [ ] Audit log records the changes

**Rider**
- [ ] Rider sees only their assigned orders; picked up → out for delivery → delivered; customer tracking updates live
- [ ] A deactivated rider loses access

**Devices & quality**
- [ ] iPhone Safari, Android Chrome, tablet, desktop; install the PWA; offline page shows
- [ ] Lighthouse: Performance / Accessibility / SEO / Best practices ≥ 90 on home and menu
- [ ] Rich Results Test validates the Restaurant structured data
