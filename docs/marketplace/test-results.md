# Validation results

All checks used local fixtures or isolated PostgreSQL. No live Stripe/Supabase configuration was changed and no application was deployed.

| Check | Result |
| --- | --- |
| Official ESLint and TypeScript | Passed |
| Marketplace ESLint and TypeScript | Passed |
| Official optimized Next.js build | Passed; retains official checkout/inventory/chat/review/referral/admin routes and excludes marketplace routes |
| Marketplace optimized Next.js build | Passed; independent route manifest includes marketplace, account, seller, owner and marketplace-only payment endpoints |
| Application isolation script | Passed: routes, imports, customer-table access, cookie namespace, no payout creation and Vercel build scopes |
| Marketplace PostgreSQL + Stripe SDK/signature tests | 25 passed |
| Marketplace Playwright | 12 passed at desktop/mobile widths, including real SDK email verification against a loopback Auth fixture |
| Official storefront Playwright | 27 scenarios verified: 25 passed initially; two new external-link assertions passed after correcting their footer landmark selector and rerunning them |

Marketplace browser coverage includes discovery, category/type/search/price filters, seller shop pages, financial dashboard, historical fee/refund display, eligibility status, actual native listing creation, anonymous gates, cookie isolation, current-owner authorization, unavailable official customer endpoints, sandbox checkout review and email OTP verification setting only marketplace cookies.

Database coverage applies the real marketplace migrations and checks owner-only approval/Partner/overrides, all automatic tier boundaries, refund/fraud/dispute exclusions, retained earned tiers, fee immutability, overselling/idempotency, suspended/unverified sellers, RLS/RPC privileges, owner-only seven-day earnings release and absence of payout creation.

Stripe contract tests use the official pinned SDK with mocked external responses and a loopback Supabase fixture. They verify current V2 parameters, actual eligible country, durable account idempotency, seller/account binding, requirements includes, secure Account Links, raw-body thin signatures/replays, inline prices, fees/destination binding, checkout reuse, partial refunds and live-key rejection. They are not a substitute for a real Stripe sandbox smoke test with configured credentials.

Builds used placeholder local Supabase/public configuration. The official sitemap logs its existing unavailable-catalog fallback without a service key; the build succeeds. The marketplace remains noindex and sandbox-only.

## Visual evidence

These screenshots come from the built marketplace app using loopback QA data. No production inventory, ratings or balances are fabricated.

- [Desktop marketplace, 1440px](screenshots/desktop.png)
- [Mobile marketplace, 390px](screenshots/mobile.png)
- [Desktop seller workspace](screenshots/seller-desktop.png)
- [Mobile seller workspace](screenshots/seller-mobile.png)

## Reproduce

From the repository root:

```sh
npm ci
npm run check
npm run check:marketplace
npm run check:isolation
npm run test:marketplace
npm run build
npm run build:marketplace
npm run test:storefront
npm run test:marketplace:browser
```

Set each build's required public environment placeholders as shown in the GitHub workflow or use a correctly configured local sandbox. Browser tests start isolated servers on 3100/54321 (official) and 3101/54322 (marketplace). On machines with a preinstalled Chromium, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`; otherwise install Playwright's Chromium. No real secrets are needed for these automated checks.
