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
