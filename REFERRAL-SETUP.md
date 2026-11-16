# BirdShop referral program — staged rollout

This branch adds the database-backed referral foundation and link capture, with $0.50 USD pending-review rewards for qualifying first-time paid, fulfilled product orders.

## Activation (not automatic)
1. Back up Supabase and apply `supabase/migrations/20261115010000_referral_foundation.sql` to a staging copy first, then production only after verification.
2. Create referrers via an owner-controlled database workflow, with unique uppercase codes (6–20 alphanumeric characters). Set status to `approved` only after identity checks. The public link is `https://birdshop.store/ref/CODEHERE`.
3. A visitor following the link receives an HttpOnly 30-day first-party cookie. New product checkout attempts bind the cookie's approved code to the checkout attempt.
4. After Stripe payment and fulfillment, the database creates one pending-review $0.50 reward. Review it manually; no payouts happen automatically.
5. Do not advertise a self-service affiliate dashboard yet. Verified customer registration, applications, payout management UI, service checkout attribution and automated refund reconciliation for already-paid rewards remain to be built.

## Safety
- All tables are private (RLS enabled; no public grants). The server uses service-role access.
- No unverified email address is allowed to view earnings.
- A code cannot refer its own matching email. One reward per referred email and one per order.
- Test-mode payments, admin tests, unpaid and unfulfilled orders do not qualify.
- Refunds reverse unpaid rewards; manually investigate paid rewards on refund.
- Test: repeat Stripe webhook, first and second purchase, self-referral, invalid code, refund, test-mode payment, and product checkout retry.
- Database migrations and deployment are **not** performed by merging the PR.
