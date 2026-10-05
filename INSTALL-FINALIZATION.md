# BirdShop finalization — install and test

This is an update for the current uploaded BirdShop project, not a standalone replacement repository. It contains complete files for every change. Keep the rest of your project. No credentials, node_modules, build output, or public asset duplicates are included.

## Install in this order

1. Back up your current project. Extract this ZIP somewhere outside the project. Copy its contents into your existing project root (the folder containing `package.json`), merging folders and replacing matching files. Do not nest the update inside a new `BirdShop` folder. Keep the new SQL and verification files in VS Code and Git.
2. Delete these two obsolete files. Their replacements are included:
   - `components/AdminAnalytics.module.css`
   - `app/admin/(protected)/chat/ServiceAgentLiveThread.tsx`
3. In your existing Supabase project's SQL Editor, run **only the new migration** `supabase/migrations/20261005220000_owner_reporting.sql`. Then run `supabase/verify-owner-reporting.sql`; all six rows should say PASS. Verification is read-only and is not a migration. Existing dated migrations must already be installed; do not replay applied migrations or any `supabase/legacy` files. This update assumes the existing chat, digital payment, hardening, customer inbox, and remembered-device migrations from your uploaded project are installed. If a prerequisite table/function is missing, stop and resolve that specific missing migration instead of recreating the database.
4. In Supabase Authentication session settings, check for a configured **Inactivity timeout** and disable that restriction if enabled. The uploaded app already had no active 15-minute logout timer. This update removes leftover activity-cookie writes and avoids treating temporary authentication/database outages as an invalid session. Provider-side time limits remain outside the application code. Keep normal JWT refresh settings; do not disable authentication or extend access tokens to compensate.
5. In your existing Vercel project, verify the environment variable names listed below are present for Production. There are **no new variable names** in this update. Keep your existing encryption and token secrets; rotating them can make existing codes or private links inaccessible. Your local `.env.local` stays local and is never staged.
6. Confirm the Stripe webhook endpoint is `https://www.birdshop.store/api/stripe/webhook` and its signing secret matches `STRIPE_WEBHOOK_SECRET` in this Vercel environment. The implemented event set is:
   - `checkout.session.completed`
   - `checkout.session.expired`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `charge.refunded`
   - `refund.created`
   - `refund.updated`
   - `refund.failed`
   Keep test credentials/events together in a test environment and live credentials/events together in Production. A Stripe browser success page alone never confirms an order.
7. Confirm Resend has verified the sending domain used by `BIRDSHOP_EMAIL_FROM`. Confirm `BIRDSHOP_ADMIN_EMAIL` points to your intended notification inbox. Real provider acceptance and inbox delivery still need your final test.
8. Keep `.github/workflows/birdshop-maintenance.yml` from your existing project. In GitHub repository Actions secrets, verify `BIRDSHOP_SITE_URL` and `CRON_SECRET`; they must match the deployed origin and Vercel worker secret. The existing scheduled workflow calls `/api/maintenance` approximately every five minutes. After deployment, run **BirdShop background maintenance → Run workflow** once and inspect its result. Scheduled execution is not an immediate-delivery guarantee.
9. Open the VS Code terminal in the project root. Use the PowerShell commands below. Check that the branch is `main` and the origin is your BirdShop repository before pushing. If you work through a different production branch, use that branch instead.

```powershell
git status --short
git branch --show-current
git remote -v
Remove-Item -LiteralPath "components/AdminAnalytics.module.css" -ErrorAction SilentlyContinue
Remove-Item -LiteralPath "app/admin/(protected)/chat/ServiceAgentLiveThread.tsx" -ErrorAction SilentlyContinue
npm ci
npm run check
node scripts/verify-finalization.mjs
npm run build
```

Only continue when these checks succeed. The local build needs your existing public Supabase variables in `.env.local`. Do not copy the fake values used in the review environment.

```powershell
git --literal-pathspecs add --pathspec-from-file=BIRDSHOP-FILES.txt
git diff --cached --stat
git diff --cached --name-only
git commit -m "Finalize admin reporting, sessions, and chat experience"
git push origin main
```

Review the staged filenames before committing, including any changes that were already staged before this update. `BIRDSHOP-FILES.txt` stages only the delivered files and the two removals; it does not stage `.env.local`.

10. In the **existing Vercel project**, confirm the Git connection is `birdshop-admin/birdshop`, the production branch is `main`, and the project root points to the folder with `package.json`. A push to the connected production branch creates the production deployment. Wait for Ready, open its commit details, and verify they match the commit you just pushed. Confirm `www.birdshop.store` belongs to this project under Domains, then open that domain. If only environment variables were changed after the last deployment, redeploy to apply them.
11. Perform the manual checklist below. Do not claim live payment/email success based only on build results.

## 1. What changed

Overview is now an operations dashboard; Analytics is a separate historical reporting screen. Both share a single paid-sale definition. Owner and service-agent chat use the same live thread and inline payment actions. Refund labels now appear consistently. Order tracking resumes after tab switches, error responses preserve rate-limit status, and admin authentication no longer treats transient upstream errors as a reason to log out.

## 2. Files created / 3. Files changed / 4. Files removed

See `FINALIZATION-FILES.md` for the exact categorized paths and `BIRDSHOP-FILES.txt` for the Git staging list. All included code files are complete replacements. The two removed components have no remaining imports. The legacy Support route remains available at `/admin/requests` for historical records but is no longer a main navigation destination. No historical records were deleted.

## 5. Supabase migrations

One new migration, in this order:

1. `supabase/migrations/20261005220000_owner_reporting.sql`

Then the read-only `supabase/verify-owner-reporting.sql`. No earlier migration was edited. The migration adds reporting indexes, a private shared paid-orders view, and owner-only report/overview RPCs. Existing reporting RPC names are compatibility adapters to the shared calculations so older open tabs/deployments keep working without competing financial formulas. These adapters can be retired in a later coordinated release.

## 6. Admin session

No custom 15-minute inactivity expiration remains in this code. Normal Supabase refresh and the existing browser-session cookie remain, along with explicit logout and active-role checks on server actions. Temporary authentication/profile failures do not deliberately sign out the user. Invalid/revoked credentials and inactive staff still lose access. Browser restart/session restoration follows browser cookie behavior; this is not a promise of permanent login. The actual Supabase project settings were not accessible here and must be checked in step 4.

## 7. Overview

Lifetime net revenue by currency, legitimate paid orders, digital units sold, and active browser sessions. Attention links cover unanswered chats, delivery/fulfillment problems, email failures, payment reconciliation, and low stock. Additional panels show service workload, recent paid orders with separate payment/work/delivery labels, masked inventory counts, and recent conversations/payments/reviews. It refreshes while visible. No fictitious trend numbers or initial zero-value flashes.

## 8. Analytics

7/30/90-day and all-time ranges apply to the same report request and all its figures. It shows gross, refunds, net, average paid-order value, service versus digital results, traffic over time, and top product quantities/revenue from purchase snapshots. Daily ranges use UTC calendar days including today; all-time charts group by month. Browser dates display locally.

Refunds are cumulative confirmed refunds attached to purchases made in the chosen period, not refund-event-date cash flow. Product revenue is gross item revenue before refunds; quantities retain historically sold units. Test orders are excluded, archived legitimate orders stay included, and currencies are never added together. Anonymous visitor counts approximate browser sessions, not verified people. Heartbeats update presence without creating page views; Live Now uses the existing two-minute window.

## 9. Chats

Preserved immediate private chat creation, remembered-device access, and verified inbox recovery. Email alone is not a secure credential on a new device. Owner and service agent share message/payment rendering; authority stays server-side. Creating/canceling a payment uses server-action results without a document navigation. Polling remains a fallback to realtime. Agent payment tools now collapse so they do not consume the entire conversation pane. Customer payment cards retain the cream/green design and show partial/full refunds.

## 10. Payments

Existing signed Stripe webhook handling, checkout attempts, idempotent finalization, and server-owned amounts are preserved. Opening a service chat creates no order. Verified successful service payment creates/links one order. Digital checkout reloads product data and records purchase snapshots. Duplicate and late events must not duplicate orders. This pass did not replace the working payment processor integration. Payment-state labels are separate from fulfillment/delivery.

## 11. Orders

Existing Service Queue, Digital, Completed, Archived, Deleted, and Testing organization is retained. Financial history remains protected; archive is organizational. Customer checkout/order polling no longer silently stops after a fixed attempt count: it pauses in hidden tabs, resumes on return/network recovery, and stops on a terminal result. A successful checkout return URL cannot manufacture a paid order.

## 12. Inventory / delivery

Existing server-only authenticated encryption, masked codes, owner-only reveal, duplicate detection, transactionally locked assignment, and metadata-only audit logging remain. Delivery retry reuses assigned codes. Payment remains paid if email fails or inventory is short. Sold/disclosed codes are not returned to available stock by a refund. Overview surfaces failures and shortages; recovery tools remain in Orders/Settings. Provider acceptance is the application's delivery milestone, not proof an email was read or arrived in the inbox.

## 13. Security

New owner RPCs enforce active-owner authorization with empty search paths, denied anonymous grants, and a private reporting view. Existing role/RLS/payment/code protections remain. Safe public errors preserve 403/429 status and Retry-After where handled, while unknown errors are sanitized. Inventory/product errors no longer expose raw database text. Private chat/inbox/device routes receive private cache/referrer/indexing protections. No new secret is added to a client component or public environment variable.

## 14. Mobile

Overview and Analytics have responsive cream/olive cards, stacked panels, accessible range controls, and exact-value chart details. Owner chat has a dedicated mobile conversation pane; staff chat shares the live thread and has a compact collapsible payment panel. Admin controls use readable mobile form text, and navigation retains the mobile menu/desktop sidebar. Existing Orders, Products, Inventory, Reviews, and Settings card/form layouts are retained. CSS and rendered-route checks passed; physical-phone keyboard behavior and visual appearance still require the checklist below.

## 15. Environment variable names only

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
RESEND_API_KEY
BIRDSHOP_SITE_URL
BIRDSHOP_EMAIL_FROM
BIRDSHOP_ADMIN_EMAIL
BIRDSHOP_RATE_LIMIT_SECRET
CRON_SECRET
INVENTORY_ENCRYPTION_KEY
BIRDSHOP_ORDER_TOKEN_SECRET
```

## Validation performed

- ESLint and TypeScript checks.
- Next.js production build with placeholder public Supabase configuration; no production credentials used.
- Local PostgreSQL-compatible PGlite fixtures: payment idempotency, digital allocation/retry invariants, financial-history protection, permissions, and new reporting/ranges/archival checks. These are fixture executions, not execution against your hosted Supabase project.
- Local production HTTP checks: public routes, anonymous admin blocking, unsigned webhook rejection, worker authorization, origin validation, private headers, and preserved assets.
- Focused executable polling/error/refund tests included as `scripts/verify-finalization.mjs`.
- See `FINALIZATION-TEST-RESULTS.txt` for recorded results.

Not performed: authenticated live browser flows, phone screenshots/keyboard tests, real or Stripe-test-mode transactions against your account, actual Resend delivery, hosted Supabase migration execution, GitHub push, or Vercel deployment. Provider credentials were not available. Complete those checks below after installation.

## Final manual checklist

- [ ] Home, navigation, How to Order, Services (Custom), Products, Reviews, Contact, cart and Discord backup link work at desktop and phone widths.
- [ ] Create a service conversation: it opens private chat immediately and creates no service order yet. Refresh preserves access. Remembered-device conversation selection works. New-device recovery verifies ownership.
- [ ] Owner and assigned agent can reply; customer receives messages; closed chats behave correctly. Draft text survives payment creation/cancellation. Cancel from the inline card without document reload.
- [ ] Payment controls are centered and match the site; cream customer cards show pending, paid, partially refunded and refunded states correctly.
- [ ] Service test payment produces exactly one linked order after a verified webhook. Duplicate webhook delivery creates no second order/message. Cancellation/expiry blocks stale unpaid requests.
- [ ] Digital product/cart payment creates one digital order with purchased names/prices/quantities. Correct quantity of unique codes is assigned and delivered. A changed current price does not change that order.
- [ ] In a safe test setup, exercise failed delivery and retry: payment stays paid and the same codes are reused. Exercise insufficient inventory recovery against the same order.
- [ ] Partial/full refunds update correctly, duplicates do not inflate refunds, and sold codes remain sold. Archive preserves revenue, units, and refund history.
- [ ] Overview shows actual attention queues, inventory, recent orders and active browser counts. Multiple heartbeats from one browser do not multiply Live Now.
- [ ] Analytics 7/30/90/all ranges change all figures together; validate gross minus refunds equals net separately for each currency. Check a refund and an archived purchase.
- [ ] Orders, Products, Inventory, Reviews and Settings retain working controls and loading/empty/error states. Hidden reviews are not public; codes remain masked until owner reveal.
- [ ] Test owner, service agent, and signed-out direct URLs. Agents cannot access owner reporting, inventory reveal, or unrelated private chats. Changing private references/tokens cannot reveal another customer.
- [ ] Test 320px, 390px, tablet and desktop widths; open/close the mobile menu, enter a conversation, go Back, open payment tools, and type with the phone keyboard open. Composer and action buttons remain reachable.
- [ ] Leave Admin inactive for **more than 15 minutes** (preferably 20–30), return, navigate and refresh: it stays signed in. Test another tab, then explicit Logout. Temporary network loss must not intentionally log out all tabs.
- [ ] Run maintenance manually and confirm recovery jobs complete. Confirm actual email receipt and Stripe webhook success in their dashboards. Verify the Vercel production commit matches your push.

## References for deployment/session settings

- https://vercel.com/docs/git
- https://vercel.com/docs/environment-variables
- https://supabase.com/docs/guides/auth/sessions
