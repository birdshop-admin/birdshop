# BirdShop referral program — staged rollout

This branch includes the first customer referral and affiliate application experience, owner review, and the private USD $0.50 reward ledger. **This is not production deployed.**

## Features in the draft PR
- `/referrals`: email sign-in via Supabase, six-digit code entry when the project's email template supports it, or email link callback; registration and private earnings summary.
- Verified customers can register as ordinary referrers and receive a code automatically.
- Affiliate applicants register as `pending` until the owner approves them.
- `/admin/referrals`: owner-only registration, approvals/suspensions and manual reward review and paid-state recording.
- `/ref/CODE`: first-party, HttpOnly 30-day cookie on valid approved links.
- New **product checkout attempts only** bind the referral code; one eligible $0.50 pending-review reward per first-time customer and fulfilled, live, paid product order.
- Refunds reverse unpaid rewards. Automatic money transfers are **not** implemented.

## Required before use
1. Back up the database. Test on a staging copy of Supabase, never directly on live data first.
2. Apply the new `supabase/migrations/20261115010000_referral_foundation.sql` after the existing migrations; verify RLS/grants and trigger compatibility in staging.
3. Configure Supabase Auth email provider and its confirmation template. For email links, allowlist `https://birdshop.store/referrals/auth/callback` in the Supabase redirect allowlist. The browser callback handles PKCE code exchange. Numeric OTP entry only works if the email template exposes a suitable code.
4. Ensure `BIRDSHOP_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are correct in each environment. Do not make Supabase secret keys public.
5. Test verified registration, duplicate email, sign-in expiry, customer and affiliate approval statuses, referral link attribution, payment and fulfillment triggers, repeat webhook and checkout, Stripe test-mode exclusion, first-time buyer filtering, partial/full refund, and payout controls.
6. Run `npm run check` and `npm run build` against test environment, then review CI, SQL tests and the draft PR before merging.

## Not implemented yet
- Verification of ownership for referrers **created manually by an admin** if the email differs from a Supabase account; their email owner must verify in `/referrals` to see that referrer's dashboard.
- Manual Discord referral-code entry on checkout.
- Service/package checkout attribution.
- Automated disbursement and payout-provider integration.
- A complete accounting audit with payout IDs, refund-after-payout recovery, cap enforcement and scalable paginated reporting.
- Production Supabase migration, deployment and end-to-end tests.

## Safety notes
- Customer dashboard requires a live Supabase user with a verified email; the server uses the authenticated email to scope queries.
- No referrer payout details are exposed publicly.
- The owner must manually mark a reward paid only after independently making the payment.
- `/referrals` is public customer access, whereas `/admin/referrals` remains owner-only.
- Do not promise customers that pending rewards are payable until review and fraud checking.
