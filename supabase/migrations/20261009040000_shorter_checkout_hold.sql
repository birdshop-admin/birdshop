-- BirdShop: unpaid checkouts hold codes for 35 minutes instead of 1 hour.
-- Stripe requires a Checkout Session to stay open for at least 30 minutes, so 35
-- leaves a small margin. Only the default for NEW attempts changes; existing
-- attempts keep their expiry, and no rows are touched.
-- lib/payment-service.ts (startCheckout) uses the same 35-minute window when it
-- refreshes an attempt whose first Stripe call never happened.
begin;

alter table public.birdshop_checkout_attempts
  alter column expires_at set default (now() + interval '35 minutes');

notify pgrst, 'reload schema';
commit;
