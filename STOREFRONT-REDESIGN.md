# BirdShop charcoal storefront — draft review

## Visual direction
The supplied Aer “Work Anywhere” screenshot is the composition reference: a narrow vertical rail, a quiet top bar, dramatic imagery, an oversized right-side headline, collection links on the left, and a compact information band below. BirdShop keeps its cream BS mark, existing landscape images, actual catalog, community link and service workflow. Public dark mode uses charcoal and muted gold. A visitor's explicit light-mode preference still works; the staff dashboard retains its independent theme.

The hero prefers the first available, featured service with approved, sanitized catalog artwork. With no service image, BirdShop's existing landscape and cream mark provide the fallback. No unapproved Roblox artwork or Aer assets were introduced. Hero navigation leads to real services and products; lower cards retain live stock, cart actions, prices and loading/error recovery.

## Referral integration
This branch starts at PR #1 commit `59ebe69aa317471065014c5294dffffebd80634d`. PR #1 remains open and unmerged. Its attribution, verified customer dashboard, owner dashboard, ledger migration and checkout integration are included unchanged except for customer dashboard presentation. Rewards are accessible from the top bar, rail, full menu, footer and homepage information band.

PR #1's limitations still apply: new product purchases only, manual reward review and payments, no service attribution, no automated payouts. Read `REFERRAL-SETUP.md`. The migration has not been applied. No live payment, email, auth settings or database changes were made.

## Scope and review
The redesign changes public presentation and navigation. Existing Supabase authentication, inventory, checkout, payment webhooks, service/chat and order handlers are retained. The shared chrome is scoped to pages rendering SiteHeader; staff pages keep their layout. All original navigation remains available in the rail menu on desktop and the disclosure menu on mobile.

`vercel.json` disables automatic deployments for `feat/aer-charcoal-storefront`. Other branches retain their existing deployment behavior. This is a draft; do not merge or deploy until staging verification and owner approval.

## Validation
- Lint, TypeScript and optimized production build run locally with non-secret placeholder public Supabase configuration. A build without the public URL/key fails in the existing CartProvider, so CI supplies placeholders.
- Local browser launch and preview connections are blocked by this execution environment. Desktop/mobile screenshots and interaction results must come from the GitHub Actions browser job before claiming those checks passed.
- `Storefront redesign checks` runs lint, TypeScript, build and Playwright. It captures full-page screenshots at 320, 390, 768, 1024 and 1440px plus services and referrals. The fixture server supplies illustrative catalog data on loopback only; no live account or database is used. Browser artifacts are retained for 14 days.
- Browser assertions cover overflow, menu disclosure/Escape focus, referral navigation, stock restrictions, cart count and reload persistence, service/referral routes, and isolation of the staff login layout.
- Fixture checks do not establish live Stripe/Supabase functionality. Staging checkout, webhooks, email verification, SQL/RLS and referral reward/refund tests remain required before approval.

To reproduce on a machine with Chromium support:

```sh
npm ci
npx playwright install --with-deps chromium
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=qa-placeholder BIRDSHOP_SITE_URL=http://127.0.0.1:3100 npm run build
npm run test:storefront
```

Design preview HTML shared in chat is a static render with illustrative service names. It is not a functional store or evidence of browser test success.
