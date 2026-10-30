-- =====================================================================
-- Payment reconciliation support: lets the server poll Razorpay for
-- payments whose browser callback/webhook never arrived, so the webhook
-- is a fast path rather than a hard requirement.
-- =====================================================================

alter table public.payments add column if not exists last_reconciled_at timestamptz;

create index if not exists payments_reconcile_idx
  on public.payments (last_reconciled_at nulls first, created_at)
  where status in ('created', 'authorized', 'failed', 'refund_pending');
