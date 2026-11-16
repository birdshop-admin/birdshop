# BirdShop — Rewarble + crypto payment expansion (staged, not live)

This branch **does not change the existing Stripe checkout, checkout reservations, order fulfillment, billing, or production payment availability**.

## What is actually implemented

- Public checkout guidance for eligible Rewarble-issued **Visa/Mastercard prepaid cards**. The customer redeems the voucher on Rewarble, chooses a card, then uses BirdShop's existing Stripe checkout. Individual card acceptance remains up to the issuer / Stripe.
- A link to request **manual discussion** about direct Rewarble voucher-code acceptance. This is an inquiry, **not a payment**, and customers are explicitly told not to send a code before approval.
- Crypto payment provider adapter in `lib/payments/nowpayments.ts`: invoice request construction, signed-IPN verification (HMAC-SHA512), status classification that only considers `finished` settled. It has **no public payment endpoint and no order-finalization path**, intentionally.

## Missing before direct Rewarble voucher acceptance

1. Obtain written confirmation from Rewarble (or authorized partner) that BirdShop can collect and redeem third-party vouchers commercially, and ask about API/merchant settlement support.
2. Decide permitted currencies/denominations and settlement fees, including how to handle partial/overpayment, already-redeemed codes, expired codes, disputes, and refunds.
3. Add an **encrypted**, access-controlled intake workflow (do not log codes; never store them in plain text), with owner review and evidence of redemption.
4. Only after actual funds arrive, finalize a provider-neutral order using an auditable ledger. Never auto-fulfill on a code submission, screenshot, or unverified claim.
5. Recalculate product availability at fulfillment; do not use the existing ~35-minute Stripe stock reservation for a potentially 24-hour manual voucher review.

Official public redemption information: https://rewarble.com/redeem

## Missing before accepting cryptocurrency

1. Confirm merchant and jurisdiction eligibility for BirdShop's digital gaming services/products with the chosen provider.
2. Open a merchant **sandbox** account, generate a sandbox API key and IPN signing secret, configure permitted wallet(s) and supported coins / networks.
3. Add a provider-neutral checkout schema / state machine, binding each invoice to a **server-priced** order or attempt, with a unique provider invoice ID and idempotency lock.
4. Use only provider-generated invoice URLs; all customer-selected coins/networks must be validated server-side.
5. Implement an IPN endpoint with HMAC validation, durable event storage, deduplication, retries, and processor reconciliation. Confirm status with the provider API before applying irreversible effects.
6. Make allocation / release / refund / underpayment / overpayment / expired invoice behavior independent from the Stripe-only `birdshop_v2_finalize_product_payment` RPC.
7. **Only a fully settled payment** may produce an order or release digital keys. No automatic release for `waiting`, `confirming`, `confirmed`, `sending`, or `partially_paid`.
8. Audit webhook replay, duplicate settlement, missing invoices, out-of-order events, crypto payment after stock expiry, price changes, refunds, and support recovery.
9. Verify under sandbox and manual QA. Do not enable real payment acceptance until the owner explicitly approves.

NOWPayments developer information: https://nowpayments.io/api

### Environment placeholders (do not activate without the fulfillment work)

```dotenv
# No real credentials in the repository.
BIRDSHOP_CRYPTO_INVOICES_ENABLED=false
NOWPAYMENTS_SANDBOX=true
# NOWPAYMENTS_API_KEY=
# NOWPAYMENTS_IPN_SECRET=
```

**Warning:** `BIRDSHOP_CRYPTO_INVOICES_ENABLED=true` alone does not enable a usable checkout. The invoice adapter must be connected to provider-neutral order persistence and verified fulfillment in a separate code-reviewed phase.

## Checkout and UI design

The existing `ProductCheckout` still submits `/api/checkout` to Stripe, unmodified. The extra information panel clarifies how a customer could try an eligible Rewarble prepaid card and that direct gift-card codes / cryptocurrency aren't currently available as verified payment methods.

## Rollout constraints

No merge to `main`, production deployment, database migration, live payment collection, or gift-code processing without separate explicit owner approval. The payment provider's merchant agreement and applicable local rules must be reviewed before launch.

## Manual Rewarble code intake (new, NOT live)

This branch includes a secure manual request flow in `components/RewarbleManualRequest.tsx`,
`app/api/payment-requests/rewarble/route.ts`, and the owner-only
`/admin/rewarble` review queue.

- Customer enters a 16-digit *unused* Rewarble voucher, claimed USD value,
  name/email, and selects the products from an actual existing cart.
- The server reprices from public `products` rows, validates quantities and
  rate limits, optionally verifies Cloudflare Turnstile, encrypts the code
  using the existing `INVENTORY_ENCRYPTION_KEY`, and stores only ciphertext,
  a keyed HMAC digest, and a last-four-digit hint.
- The client gets an opaque private status link. No Stripe attempt or
  `orders` row is created, no inventory is reserved, and **nothing is delivered**.
- Admin is strictly owner-only. Codes are revealed on a separate server-rendered
  review page with audit logging and no automatic browser prefetch.
- After the owner actually redeems the code and confirms the funds settled,
  they may mark `redeemed` and later `fulfilled` only after handling delivery
  manually through an appropriate supported workflow.
- Rejected/redeemed requests erase stored code ciphertext. Redemption is never
  attempted by BirdShop's server or any browser automation.

### How to activate *in staging only* (not production)

1. Obtain confirmation that BirdShop is permitted to accept/transact Rewarble
   codes through an authorized arrangement. Review fees, identity/KYC,
   refunds and the risks of one-time-code transfer.
2. Apply `supabase/migrations/20261116090000_rewarble_manual_requests.sql`
   to your staging Supabase project and confirm owner-only RLS.
3. Confirm secrets already used by BirdShop are available in server
   configuration: `SUPABASE_SECRET_KEY`, `INVENTORY_ENCRYPTION_KEY`,
   `BIRDSHOP_ORDER_TOKEN_SECRET`, `BIRDSHOP_RATE_LIMIT_SECRET`.
4. Set these two feature flags **only in staging**:
   ```dotenv
   BIRDSHOP_REWARBLE_MANUAL_ENABLED=true
   NEXT_PUBLIC_REWARBLE_MANUAL_ENABLED=true
   ```
   They default to false. The first protects the server, the second controls
   the visible form. Restart the Next.js server after changing them.
5. Test with a *non-live, non-redeemable* test voucher, simulated records and
   the staging admin account. Never put real voucher codes into test logs.
6. Demonstrate status tracking, duplicate rejection, RLS isolation,
   admin reveal audit, review status changes and no automated delivery.
7. Do not turn on live intake until the owner signs off on a documented
   real-code verification and customer-resolution process.

### Important implementation limitation

The Rewarble flow is **only a manual request queue**, not a fully integrated
alternate settlement method. Marking a request `redeemed` or `fulfilled`
does not update `orders`, allocate `product_inventory`, trigger digital-key
emails, or mark Stripe paid. Owner must arrange any manual fulfillment
separately, and should only do so after confirmed receipt of funds.

The public Rewarble redemption page at https://rewarble.com/redeem is a
consumer-facing login/redemption flow. No public, documented merchant voucher
redemption API was verified. An unofficial scripted login/redeemer is not
a supported payment gateway.
