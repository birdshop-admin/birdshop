# BirdShop post-purchase referral credits — staging checklist

This is a **feature branch**, not a production release. The original referral foundation and this new migration must be reviewed, applied and tested in staging first. No payouts or production schema changes are authorized here.

## User behavior

1. A customer checks out normally. Coupon/promo codes still apply only to discounts.
2. Their **paid product order's private delivery page** offers an optional "Credit a friend" form, but only after the feature flag is enabled.
3. The buyer enters an approved referrer's generated code within **7 days after payment**.
4. The server validates the private order token, rate-limits the request, and calls a service-role-only database function.
5. The SQL function verifies paid/live/non-refunded product order, excludes Stripe test and admin-test orders, enforces **first paid purchase only**, and rejects self-referrals, expired windows, repeat rewards, and competing referrals. Concurrent claims by customer email are serialized with a PostgreSQL advisory lock.
6. An accepted buyer is immediately counted as a verified first-purchase referral in the referrer's dashboard. This is **not** an approved reward or payout.
7. If the order was already fulfilled, a **$0.50 pending-review reward** is created (no automatic payment). If fulfillment is later, the existing order trigger creates the reward. Partial/full refunds reverse unpaid rewards using the original refund trigger.

Gift purchases credit only the paying customer's first purchase, **not the recipient**. The one-time referral cannot be replaced after submission; an order already attributed by a referral link is not eligible for a different code.

## Staged activation order

1. Back up Supabase and use a staging project with safe test data.
2. Apply `20261115010000_referral_foundation.sql` then `20261117010000_postpurchase_referral_claims.sql` in that order.
3. Verify RPC execute grants are **service_role only**, confirm RLS and indexes, and check the trigger with live-like product/payment schemas in staging.
4. Enable `BIRDSHOP_POSTPURCHASE_REFERRALS_ENABLED=true` **only on staging** after both migrations are verified. The flag defaults to OFF. Keep `SUPABASE_SECRET_KEY`, Stripe secrets and the private order token secret server-only.
5. Test a first-time paid product order, authenticated private delivery link, valid and invalid codes, referral claimed before vs after fulfillment, immediate verified-buyer count, duplicate same-code retries, alternate-code rejection, self-referral, previous buyer, test-mode payment, partial and full refunds, seven-day expiry and invalid/missing token. Include simultaneous submissions.
6. Confirm reward remains `pending_review`, never immediately paid. Verify owner manually approves/rejects/pays through existing admin controls.
7. Run lint, TypeScript, production build, Playwright, and staging integration tests; inspect the draft PR before approving production schema/deployment.

## Limitations / launch blockers

- No database migration has been applied by this PR; it is **not live**.
- Private order token acts as claim authorization; anyone possessing it may see order data and submit a referral on that purchase. Buyers should keep delivery links private.
- Anti-fraud currently checks paying-email identity, prior paid orders, self-referral and rate limits; alternate-email abuse still needs manual moderation.
- The dashboard shows up to 100 recent ledger entries and 1,000 verified claims. Improve pagination for scale.
- Automated seller/referrer transfers and payout provider are not implemented.
- Payment and fulfillment behavior should be tested against real *staging* Stripe and Supabase webhooks before enabling.
- The Discord changelog automation is separate. Do **not** mark this draft as `major-update` until it is verified and approved for a release. Any public announcement should clearly distinguish activation from code merge.

## Key changes

- `supabase/migrations/20261117010000_postpurchase_referral_claims.sql`: guarded atomic claim RPC + attribution metadata
- `app/api/referrals/claim/route.ts`: token-authenticated and rate-limited server API
- `app/api/orders/access/route.ts`: feature gate and non-identifying existing-credit status
- `components/PostPurchaseReferral.tsx`: optional post-purchase form on private paid order
- `app/referrals/page.tsx`: verified buyer count separate from pending/approved/paid rewards
- `tests/storefront/postpurchase-referrals.spec.ts`: browser regression tests
