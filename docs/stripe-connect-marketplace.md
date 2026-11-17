> Current deployment architecture: [Independent marketplace app](marketplace/architecture-and-deployment.md). Marketplace source paths below now live under `apps/marketplace/`; its payment secret is `STRIPE_MARKETPLACE_WEBHOOK_SECRET`, its origin is `MARKETPLACE_SITE_URL`, and first-party payment code no longer imports marketplace modules.

# BirdShop Connect V2 marketplace (sandbox only)

This implementation extends the existing seller dashboard, listing moderation, marketplace and order workflow. Sellers create/edit digital products and game services in BirdShop, submit listings for approval, and manage fulfillment there. Stripe onboarding only collects identity and payout verification. Sellers never create Stripe Products or Prices. Checkout builds inline `price_data` from the approved database listing, not browser-submitted amounts.

## Sandbox boundary

No production deployment, merge, database apply, Stripe account mutation, or payment was performed while implementing this change. `getMarketplaceStripe()` uses the same singleton as first-party payments but rejects any secret other than a Stripe test/sandbox key. Marketplace objects are also checked for live mode. Live marketplace operation requires a separate code review; changing the enable flag alone cannot enable it. The existing first-party checkout remains compatible with live Stripe configuration.

The `feat/reseller-marketplace-phase1` branch is disabled in `vercel.json` automatic Git deployments. The PR stays draft.

## Configuration and local verification

Keep secrets server-only. See `.env.example`:

- Existing Supabase server/auth configuration and `BIRDSHOP_SITE_URL` (HTTPS site origin).
- `STRIPE_SECRET_KEY`: a sandbox/test platform secret; the shared client does not pin an API version.
- `STRIPE_WEBHOOK_SECRET`: existing snapshot payment endpoint's secret.
- `STRIPE_CONNECT_WEBHOOK_SECRET`: separate **thin Accounts v2** event destination secret.
- `STRIPE_CONNECT_ALLOWED_COUNTRIES`: comma-separated actual ISO two-letter seller countries, explicitly reviewed for the platform's **recipient / destination-charge** eligibility. There is no US default. Stripe onboarding verifies the seller's actual legal country. Stripe country support alone does not imply cross-border transfer eligibility.
- `BIRDSHOP_MARKETPLACE_CHECKOUT_ENABLED=false` by default. Set `true` only in the configured sandbox after migrations and event destinations are ready.
- Existing `BIRDSHOP_RATE_LIMIT_SECRET` and `CRON_SECRET` for the server limiter and maintenance.

Do not replace a production first-party Stripe secret to test this feature. Use an isolated sandbox environment with its own Supabase database, Stripe sandbox and origin. No pre-created sandbox account ID is assumed or automatically assigned to a seller.

The official SDK is pinned to **22.6.2**, the latest compatible 22.x release checked during implementation. SDK 23.1.0 removes the existing Checkout `payment_method_types` parameter; adopting it would change first-party payment configuration. All marketplace and first-party calls use one server-side client in `lib/stripe.ts`.

Run `npm ci`, `npm run check`, `npm run test:marketplace`, `npm run build`, and `npm run test:storefront`. If using an existing Chromium installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. Database tests apply all three real marketplace migrations to isolated PostgreSQL (PGlite), with only auth/admin prerequisites stubbed. Integration tests mock external SDK responses, exercise actual Supabase HTTP calls against a loopback fixture, and verify raw-body webhook signatures with Stripe's SDK.

## Database migration order

Review/apply **only to the isolated sandbox**, in order:

1. Existing prerequisites including `private.birdshop_require_server()` and owner administration.
2. `20261116230000_marketplace_phase1_foundation.sql`.
3. `20261117000000_marketplace_transaction_safety.sql`.
4. `20261117060746_marketplace_connect_tiers.sql`.

The new migration is additive and includes RLS plus explicit service-role grants on mapping/receipt tables. All new privileged RPCs revoke execution from `PUBLIC`, `anon`, and `authenticated` and check the existing server-role guard. Server actions authenticate with `auth.getUser()` and enforce seller/buyer/owner ownership. Approval, Partner status and commission overrides require an active owner at the database boundary too.

Existing provisional 10% seller defaults become Starter 8%. Non-default legacy rates and audit-confirmed owner rate changes (including an explicit 10%) are retained as overrides. Per-order historic rates and fee amounts are immutable. Review this backfill against any pre-existing sandbox sellers before applying.

## Account lifecycle

An approved active seller chooses their actual legal account country in `/sell/dashboard`. A database RPC persists one immutable creation request per seller, including its country, email/name snapshot and unique idempotency key. The server creates a V2 account with `dashboard: express`, application fee/loss responsibilities, and recipient `stripe_balance.stripe_transfers` requested. It stores a unique seller/account mapping and retrieves the current capability and requirements using V2 `include` fields.

Concurrent/retried creation uses the same persisted request. If the result remains unmapped for 23 hours, creation stops for owner reconciliation before Stripe's 24-hour idempotency retention boundary. The owner must find the account using the saved seller metadata/creation request and verify ownership before repairing the mapping; never create a replacement blindly.

Account Links are created on demand and redirected to immediately, never saved or emailed. Refresh and return routes authenticate the seller and derive their account from the database. Return URLs do not mark onboarding complete. Updated and future requirements are fetched and displayed. There is no seller-facing Stripe product management or Stripe Dashboard requirement.

Thin account events go to `/api/stripe/connect/webhook`. Configure an **Account / platform (`@self`)** thin event destination for these types:

- `v2.core.account.created`, `.updated`, `.closed`
- `v2.core.account[configuration.recipient].updated`
- `v2.core.account[configuration.recipient].capability_status_updated`
- `v2.core.account[requirements].updated`
- `v2.core.account[future_requirements].updated`
- `v2.core.account[identity].updated`
- `v2.core.account[defaults].updated`

Accounts v2 events representing connected accounts are platform resources; do not assume a connected-account snapshot destination delivers them. The handler verifies the raw-body Stripe signature with `parseEventNotification`, looks up the server-owned mapping, and fetches current Stripe state. Replays are safe; unknown/unmapped accounts never create ownership mappings. Processing failures return 500 for Stripe retry.

## Checkout, allocation and reconciliation

The existing marketplace/storefront links lead to `/marketplace/checkout/[id]`. The buyer reviews the approved listing, chooses quantity, and continues to Stripe-hosted Checkout, as with first-party purchases. Only listing ID, quantity and a request UUID cross the browser boundary. BirdShop locks the listing and seller, rejects self-purchases, suspended sellers, unapproved/out-of-stock listings and incomplete Connect accounts, reserves stock, and snapshots the effective fee atomically.

Checkout uses platform **destination charges**, inline price data, the stored connected account and `application_fee_amount`. It is single-seller and separate from first-party carts. A $100 Starter purchase snapshots an $8 application fee and $92 seller allocation before processing fees. Rounding is integer USD minor units, nearest cent with halves rounded upward. Stripe idempotency uses the order ID; retries cannot reserve inventory twice.

The snapshot payment handler `/api/stripe/webhook` routes marketplace metadata into its own order reconciliation; first-party events retain their existing finalizer. Subscribe to existing Checkout/refund events plus `charge.succeeded`, `charge.updated`, all `charge.dispute.*` lifecycle/funds events used by the handler, and `radar.early_fraud_warning.created`. Use platform payment events for platform destination charges.

Payment success is only recorded after retrieving a succeeded PaymentIntent and a paid, captured Charge whose amount, currency, destination and application fee match the immutable order. Return URLs and seller/browser input cannot confirm payment. Saved receipt IDs prevent replayed financial updates; refund totals only move forward. Current Stripe disputes and fraud signals exclude qualification and block fulfillment/completion while on hold.

Unpaid cancellation expires the Stripe session before stock is returned. Expired reservations release stock once. Existing maintenance recovers missed payment events, rotates through marketplace orders, and reconciles unknown Checkout creation outcomes by listing the exact creation window and matching order metadata before releasing stock. An uncertain session is never replaced with a second payment. Marketplace maintenance failure does not stop existing first-party maintenance/email delivery.

## Tiers and financial presentation

| Tier | Rate | Completed USD sales |
| --- | --- | --- |
| Starter | 8% | New sellers |
| Bronze | 7% | $500 |
| Silver | 6% | $2,500 |
| Gold | 5% | $10,000 |
| Partner | 4% | Active owner approval only |

Only provider-verified, paid, completed, non-fraudulent, undisputed orders qualify. Partial refunds reduce qualifying gross sales; full refunds count zero. Internal open/under-review/buyer-resolved disputes are excluded too. Qualification is USD-only; other marketplace currencies are rejected. Automatic earned tiers never decrease. Partner status is separate, and owner overrides take precedence. Clearing an override restores the earned/approved tier rate. Each new checkout freezes its rate and amount, so promotions do not rewrite historical earnings.

Dashboard pending/available earnings come from the seller's **actual Stripe USD balance**, after Stripe adjustments and fees, not a truncated ledger sum. Failed Stripe reads display unavailable balances. Recent transactions display original fee snapshots and refund/dispute notices. All products/services remain managed in the native BirdShop listing editor.

Destination charges allocate funds at payment time. The earlier seven-day local ledger hold is **an internal journal workflow, not escrow, a Stripe payout delay, or a second transfer entitlement**. Stripe controls actual balance availability and payout timing. Legacy manual payout tables remain inactive and must not be used to duplicate destination transfers. Refund initiation and dispute evidence submission continue through the platform's controlled Stripe operations; reconciliation consumes verified results. When refunding destination charges, operations must choose the intended transfer reversal/application-fee refund options; a customer refund alone does not necessarily reverse the seller transfer.

## Documentation checked

- [Stripe Accounts v2](https://docs.stripe.com/connect/accounts-v2)
- [Stripe V2 marketplace quickstart](https://docs.stripe.com/connect/marketplace/quickstart)
- [Hosted onboarding, Accounts v2](https://docs.stripe.com/connect/hosted-onboarding?accounts-namespace=v2)
- [Stripe webhooks and thin notifications](https://docs.stripe.com/webhooks)
- [Destination charges](https://docs.stripe.com/connect/destination-charges)
- [Supabase changelog](https://supabase.com/changelog.md) and [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)

The originally referenced separate user-supplied Stripe guide was not attached; the subsequent native-product-management and sandbox requirements were implemented directly. No hosted Stripe sandbox credentials were available in the execution environment, so real-account onboarding and payment smoke tests remain a sandbox configuration step. No production approval is implied by these automated tests.
