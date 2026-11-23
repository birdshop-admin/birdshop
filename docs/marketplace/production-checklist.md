# Production deployment checklist — future owner approval required

This checklist is a review artifact. None of its hosted mutations were executed.

- [ ] Review draft PR #5, both application roots, security boundaries and rollback scope. Approve merge separately; do not deploy the marketplace as a side effect of this review.
- [ ] Preserve the existing official Vercel project, `main` branch, domains, secrets, checkout, inventory and customer-service integrations.
- [ ] Confirm project roots/build/install/ignored-build settings from [architecture-and-deployment.md](architecture-and-deployment.md). Keep marketplace Git deployment disabled until the owner approves a sandbox deployment.
- [ ] Run both app builds, lint, TypeScript, isolation checks, marketplace PostgreSQL/Stripe tests, marketplace desktop/mobile tests and the official regression suite on the final revision.
- [ ] Apply reviewed migrations only to an isolated sandbox first. Verify RLS, server-role grants, current-owner checks and seller/buyer record ownership.
- [ ] Configure marketplace host-only Auth cookie, exact callback allowlist, correct email redirect templates and separate environment variables. Verify an official session cannot authenticate a marketplace browser session automatically, and vice versa.
- [ ] Create the sandbox Vercel project without an automatic production deployment; set access restrictions for review. Keep noindex and test-payment banners.
- [ ] Configure separate sandbox payment and V2 thin-event destinations and secrets. Finish a real test seller onboarding flow using their eligible country.
- [ ] Verify test payments, exact commissions, idempotency, refunds, disputes, fraud, inventory reservation/expiry, reconciliation and fulfillment eligibility with real Stripe sandbox objects.
- [ ] Select and document a Stripe-supported settlement/payout method for a seven-day hold after confirmed fulfillment. Destination-charge balances and the internal eligibility journal must not be represented as escrow. Confirm country-specific constraints and refund/transfer reversal accounting.
- [ ] Approve marketplace terms, seller agreements, listing categories, refund/dispute operations and owner review responsibilities.
- [ ] Approve marketplace domain/DNS setup. Add only `market` and any required ownership TXT record using the exact Vercel target; keep apex/`www` and mail records intact.
- [ ] Validate TLS, canonical marketplace origin, host-only cookies, callback origins and endpoint-specific signature verification.
- [ ] Approve an explicit live-mode code/configuration change. The current app rejects live Stripe keys; enabling the sandbox checkout flag is insufficient.
- [ ] Enable real payouts only in a separately reviewed implementation after settlement and reconciliation are proven. This PR contains no real payout route.
- [ ] Enable a marketplace-specific reconciliation schedule using its own origin and cron secret. Do not alter official maintenance.
- [ ] Deploy only the approved marketplace revision/project. Smoke-test both domains and verify marketplace-only changes skip official deployment.
- [ ] Rollback plan: disable marketplace checkout/deployments, preserve webhook/reconciliation processing for existing orders, revert the marketplace app revision or domain mapping only, and retain financial audit records. Do not drop shared tables or undo official settings during a marketplace rollback.
